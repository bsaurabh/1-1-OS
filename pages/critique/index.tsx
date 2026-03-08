import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import type { NextPage } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import CritiqueList from '@/components/critique/CritiqueList'
import { withAuth, WithAuthProps } from '@/lib/withAuth'

interface CritiqueListItem {
  id: string
  featureName: string
  status: string
  stage: string
  clarityScore: number | null
  createdAt: string
}

interface CritiqueIndexProps extends WithAuthProps {
  managerEmail: string
}

const CritiqueIndexPage: NextPage<CritiqueIndexProps> = ({ managerEmail }) => {
  const router = useRouter()
  const [critiques, setCritiques] = useState<CritiqueListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/critique')
      .then((r) => r.json())
      .then((data) => setCritiques(data.critiques || []))
      .catch(() => setCritiques([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout managerEmail={managerEmail}>
      <div className="max-w-3xl mx-auto py-8 px-4">
        {loading ? (
          <div className="flex flex-col items-center py-16 text-gray-500">
            <div className="w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading critiques…</p>
          </div>
        ) : (
          <CritiqueList
            critiques={critiques}
            onNewClick={() => router.push('/critique/new')}
          />
        )}
      </div>
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(CritiqueIndexPage, async (_ctx, managerId) => {
  const { prisma } = await import('@/lib/prisma')
  const manager = await prisma.manager.findUnique({
    where: { id: managerId },
    select: { email: true },
  })
  return { props: { managerEmail: manager?.email ?? '' } }
})
export default _page
export const getServerSideProps = _getServerSideProps
