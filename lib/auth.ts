import { SignJWT, jwtVerify, JWTPayload } from 'jose'

export interface SessionPayload {
  managerId: string
  email: string
}

function getSecret(): Uint8Array {
  const secret = process.env.SECRET_KEY
  if (!secret) throw new Error('SECRET_KEY environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ managerId: payload.managerId, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret())
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret())
  return {
    managerId: payload.managerId as string,
    email: payload.email as string,
  }
}
