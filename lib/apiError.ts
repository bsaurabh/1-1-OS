import type { NextApiResponse } from 'next'

export const INTERNAL_ERROR = 'Something went wrong. Please try again.'

export function sendError(
  res: NextApiResponse,
  status: 400 | 401 | 404 | 405 | 409 | 422 | 500,
  message: string
): void {
  res.status(status).json({ error: message })
}
