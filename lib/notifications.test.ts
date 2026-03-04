// Set VAPID env vars before module load to prevent setVapidDetails error
process.env.VAPID_SUBJECT = 'mailto:test@example.com'
process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BExamplePublicKey'
process.env.VAPID_PRIVATE_KEY = 'ExamplePrivateKey'
process.env.RESEND_API_KEY = 're_test_key'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}))

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn() },
  })),
}))

jest.mock('./prisma', () => ({
  prisma: {
    pushSubscription: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
    },
    manager: {
      findUnique: jest.fn(),
    },
  },
}))

import webPush from 'web-push'
import { subscribe, unsubscribe, notifyAnalysisComplete } from './notifications'
import { prisma } from './prisma'

const mockWebPush = webPush as jest.Mocked<typeof webPush>
const mockPrisma = prisma as jest.Mocked<typeof prisma>

const MANAGER_ID = 'mgr-1'
const MEETING_ID = 'mtg-1'
const MOCK_SUB = { endpoint: 'https://push.example.com', keys: { p256dh: 'key', auth: 'auth' } }

describe('subscribe', () => {
  it('upserts the push subscription', async () => {
    ;(mockPrisma.pushSubscription.upsert as jest.Mock).mockResolvedValue({})
    await subscribe(MANAGER_ID, MOCK_SUB)
    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { managerId: MANAGER_ID },
        create: { managerId: MANAGER_ID, subscription: MOCK_SUB },
        update: { subscription: MOCK_SUB },
      })
    )
  })
})

describe('unsubscribe', () => {
  it('deletes the push subscription', async () => {
    ;(mockPrisma.pushSubscription.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    await unsubscribe(MANAGER_ID)
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { managerId: MANAGER_ID },
    })
  })
})

describe('notifyAnalysisComplete', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sends push notification when subscription exists', async () => {
    ;(mockPrisma.pushSubscription.findUnique as jest.Mock).mockResolvedValue({
      managerId: MANAGER_ID,
      subscription: MOCK_SUB,
    })
    ;(mockPrisma.manager.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com' })
    ;(mockWebPush.sendNotification as jest.Mock).mockResolvedValueOnce({})

    await notifyAnalysisComplete(MANAGER_ID, MEETING_ID)
    expect(mockWebPush.sendNotification).toHaveBeenCalled()
  })

  it('swallows push errors', async () => {
    ;(mockPrisma.pushSubscription.findUnique as jest.Mock).mockResolvedValue({
      managerId: MANAGER_ID,
      subscription: MOCK_SUB,
    })
    ;(mockPrisma.manager.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com' })
    ;(mockWebPush.sendNotification as jest.Mock).mockRejectedValueOnce(new Error('push failed'))

    // Should NOT throw
    await expect(notifyAnalysisComplete(MANAGER_ID, MEETING_ID)).resolves.not.toThrow()
  })

  it('swallows email errors', async () => {
    ;(mockPrisma.pushSubscription.findUnique as jest.Mock).mockResolvedValue(null)
    ;(mockPrisma.manager.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com' })

    const { Resend } = require('resend')
    Resend.mockImplementation(() => ({
      emails: { send: jest.fn().mockRejectedValueOnce(new Error('email failed')) },
    }))

    await expect(notifyAnalysisComplete(MANAGER_ID, MEETING_ID)).resolves.not.toThrow()
  })
})
