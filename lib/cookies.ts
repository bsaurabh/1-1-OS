import type { NextApiResponse } from 'next'

const COOKIE_NAME = 'session'

export function setSessionCookie(res: NextApiResponse, token: string): void {
  const cookieParts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]

  if (process.env.NODE_ENV === 'production') {
    cookieParts.push('Secure')
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '))
}

export function clearSessionCookie(res: NextApiResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  )
}
