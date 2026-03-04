import { sendError, INTERNAL_ERROR } from '@/lib/apiError'
import type { NextApiResponse } from 'next'

function mockResponse() {
  let statusCode = 200
  let body: unknown = null
  return {
    status: (code: number) => {
      statusCode = code
      return { json: (data: unknown) => { body = data } }
    },
    getStatus: () => statusCode,
    getBody: () => body,
  } as unknown as NextApiResponse & { getStatus: () => number; getBody: () => unknown }
}

describe('apiError utilities', () => {
  it('sends correct status and error body', () => {
    const res = mockResponse() as any
    sendError(res, 400, 'Validation failed')
    expect(res.getStatus()).toBe(400)
    expect(res.getBody()).toEqual({ error: 'Validation failed' })
  })

  it('INTERNAL_ERROR is a safe generic message', () => {
    expect(INTERNAL_ERROR).toBe('Something went wrong. Please try again.')
  })
})
