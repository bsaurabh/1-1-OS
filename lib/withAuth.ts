import type {
  NextPage,
  GetServerSideProps,
  GetServerSidePropsContext,
  GetServerSidePropsResult,
} from 'next'
import type { NextApiRequest, NextApiResponse } from 'next'
import { verifySessionToken } from './auth'

export interface WithAuthProps {
  managerId: string
}

type InnerGetServerSideProps<P extends object> = (
  ctx: GetServerSidePropsContext,
  managerId: string
) => Promise<GetServerSidePropsResult<P>>

type ApiHandler = (req: NextApiRequest, res: NextApiResponse, managerId: string) => Promise<unknown>

// Overload 1: API route handler — returns Next.js API middleware
export function withAuth(handler: ApiHandler): (req: NextApiRequest, res: NextApiResponse) => Promise<void>
// Overload 2: Page component — returns [Page, getServerSideProps] tuple
export function withAuth<P extends WithAuthProps>(
  Page: NextPage<P>,
  innerGetServerSideProps: InnerGetServerSideProps<Omit<P, 'managerId'>>
): [NextPage<P>, GetServerSideProps<P>]

export function withAuth<P extends WithAuthProps>(
  handlerOrPage: ApiHandler | NextPage<P>,
  innerGetServerSideProps?: InnerGetServerSideProps<Omit<P, 'managerId'>>
) {
  // API route handler: 3 formal params (req, res, managerId)
  if (handlerOrPage.length === 3) {
    const apiHandler = handlerOrPage as ApiHandler
    return async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
      const token = req.cookies['session']
      if (!token) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      try {
        const payload = await verifySessionToken(token)
        await apiHandler(req, res, payload.managerId)
      } catch {
        res.status(401).json({ error: 'Unauthorized' })
      }
    }
  }

  // Page component — return [Page, getServerSideProps] so the page file
  // can export getServerSideProps as a proper named export (Next.js requirement)
  const Page = handlerOrPage as NextPage<P>

  const ssProps: GetServerSideProps<P> = async (ctx: GetServerSidePropsContext) => {
    const token = ctx.req.cookies['session']
    if (!token) {
      return { redirect: { destination: '/auth/login', permanent: false } }
    }

    let managerId: string
    try {
      const payload = await verifySessionToken(token)
      managerId = payload.managerId
    } catch {
      return { redirect: { destination: '/auth/login', permanent: false } }
    }

    if (innerGetServerSideProps) {
      const innerResult = await innerGetServerSideProps(ctx, managerId)
      if ('redirect' in innerResult || 'notFound' in innerResult) {
        return innerResult as GetServerSidePropsResult<P>
      }
      return { props: { ...innerResult.props, managerId } as P }
    }

    return { props: { managerId } as P }
  }

  return [Page, ssProps] as [NextPage<P>, GetServerSideProps<P>]
}
