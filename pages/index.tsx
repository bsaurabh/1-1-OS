import type { GetServerSideProps } from 'next'
import { verifySessionToken } from '@/lib/auth'

export default function Home() {
  return null
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = ctx.req.cookies['session']

  if (token) {
    try {
      await verifySessionToken(token)
      return { redirect: { destination: '/dashboard', permanent: false } }
    } catch {
      // Invalid/expired token — fall through to login redirect
    }
  }

  return { redirect: { destination: '/auth/login', permanent: false } }
}
