import webPush from 'web-push'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

// Configure VAPID at module load — will throw at startup if vars missing
if (
  process.env.VAPID_SUBJECT &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export async function subscribe(
  managerId: string,
  subscription: object
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { managerId },
    create: { managerId, subscription },
    update: { subscription },
  })
}

export async function unsubscribe(managerId: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { managerId } })
}

export async function notifyAnalysisComplete(
  managerId: string,
  meetingId: string
): Promise<void> {
  // Push notification — swallow all errors (TD-13)
  try {
    const record = await prisma.pushSubscription.findUnique({
      where: { managerId },
    })
    if (record) {
      const payload = JSON.stringify({
        title: 'Meeting analysis ready',
        body: 'Your meeting has been analyzed. Tap to review.',
        url: `/meeting/${meetingId}`,
      })
      await webPush.sendNotification(record.subscription as unknown as webPush.PushSubscription, payload)
    }
  } catch {
    // swallow push errors
  }

  // Email notification — swallow all errors
  try {
    const manager = await prisma.manager.findUnique({
      where: { id: managerId },
      select: { email: true },
    })
    if (manager && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'noreply@1on1os.app',
        to: manager.email,
        subject: 'Meeting analysis complete',
        html: `<p>Your meeting analysis is ready. <a href="${process.env.NEXT_PUBLIC_APP_URL}/meeting/${meetingId}">View results</a></p>`,
      })
    }
  } catch {
    // swallow email errors
  }
}

export async function notifyAnalysisFailed(managerId: string): Promise<void> {
  // Email only for failures — swallow all errors
  try {
    const manager = await prisma.manager.findUnique({
      where: { id: managerId },
      select: { email: true },
    })
    if (manager && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'noreply@1on1os.app',
        to: manager.email,
        subject: 'Meeting analysis failed',
        html: '<p>We were unable to analyze your meeting notes after multiple attempts. Please try submitting again.</p>',
      })
    }
  } catch {
    // swallow email errors
  }
}
