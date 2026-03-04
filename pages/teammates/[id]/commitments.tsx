import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import type { NextPage, GetServerSidePropsContext } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import CommitmentList from '@/components/commitments/CommitmentList'
import AddCommitmentModal from '@/components/commitments/AddCommitmentModal'
import BrokenPatternSignals from '@/components/commitments/BrokenPatternSignals'
import { withAuth, WithAuthProps } from '@/lib/withAuth'

interface Commitment {
  id: string
  text: string
  owner: 'MANAGER' | 'TEAMMATE'
  status: 'OPEN' | 'CARRIED_FORWARD' | 'DONE' | 'DROPPED'
  carryCount: number
  dueDate: string | null
  createdAt: string
}

interface CommitmentsPageProps extends WithAuthProps {
  managerEmail: string
  teammateName: string
  teammateId: string
}

const CommitmentsPage: NextPage<CommitmentsPageProps> = ({ managerEmail, teammateName, teammateId }) => {
  const router = useRouter()

  const [openCommitments, setOpenCommitments] = useState<Commitment[]>([])
  const [resolvedCommitments, setResolvedCommitments] = useState<Commitment[]>([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const loadCommitments = useCallback(async () => {
    setLoading(true)
    try {
      const [openRes, resolvedRes] = await Promise.all([
        fetch(`/api/teammates/${teammateId}/commitments?status=open`),
        fetch(`/api/teammates/${teammateId}/commitments?status=resolved`),
      ])
      const [openData, resolvedData] = await Promise.all([openRes.json(), resolvedRes.json()])
      setOpenCommitments(openData.commitments ?? [])
      setResolvedCommitments(resolvedData.commitments ?? [])
    } catch (err) {
      console.error('[commitments] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [teammateId])

  useEffect(() => {
    loadCommitments()
  }, [loadCommitments])

  async function handleAction(id: string, action: string) {
    try {
      const res = await fetch(`/api/commitments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) return
      const data = await res.json()
      const updated: Commitment = data.commitment

      // Optimistic UI: update local state based on new status
      if (updated.status === 'DONE' || updated.status === 'DROPPED') {
        setOpenCommitments((prev) => prev.filter((c) => c.id !== id))
        setResolvedCommitments((prev) => [updated, ...prev].slice(0, 20))
      } else {
        // CARRIED_FORWARD — update in place
        setOpenCommitments((prev) => prev.map((c) => (c.id === id ? updated : c)))
      }
    } catch (err) {
      console.error('[commitments] action error:', err)
      showToast('Action failed. Please try again.')
    }
  }

  function handleAddSuccess(commitment: Commitment) {
    setOpenCommitments((prev) => [...prev, commitment])
    setIsAddModalOpen(false)
    showToast('Commitment added.')
  }

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  return (
    <AppLayout managerEmail={managerEmail}>
      <div data-testid="commitments-page" className="max-w-2xl mx-auto py-8 px-4">
        {/* Back nav */}
        <div className="mb-4">
          <button
            onClick={() => router.push(`/teammates/${teammateId}`)}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to {teammateName}
          </button>
        </div>

        {/* Tab nav */}
        <nav data-testid="teammate-tabs" className="flex gap-1 mb-6 border-b border-gray-200">
          {[
            { label: 'Profile', href: `/teammates/${teammateId}`, testid: 'tab-profile' },
            { label: 'Timeline', href: `/teammates/${teammateId}/timeline`, testid: 'tab-timeline' },
            { label: 'Commitments', href: `/teammates/${teammateId}/commitments`, testid: 'tab-commitments', active: true },
            { label: 'Brief', href: `/teammates/${teammateId}/brief`, testid: 'tab-brief' },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              data-testid={tab.testid}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab.active
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Commitments — {teammateName}</h1>
          <button
            data-testid="add-commitment-btn"
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add Commitment
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Active commitments */}
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Active</h2>
              <CommitmentList
                commitments={openCommitments}
                onAction={handleAction}
                showActions
                emptyMessage="No active commitments. Add one above."
              />
              <BrokenPatternSignals commitments={openCommitments} />
            </section>

            {/* Resolved (collapsible) */}
            <section>
              <button
                data-testid="show-resolved-btn"
                onClick={() => setShowResolved((v) => !v)}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 mb-3 flex items-center gap-1"
              >
                {showResolved ? '▾' : '▸'} Resolved ({resolvedCommitments.length})
              </button>
              {showResolved && (
                <CommitmentList
                  commitments={resolvedCommitments}
                  onAction={handleAction}
                  showActions={false}
                  emptyMessage="No resolved commitments yet."
                />
              )}
            </section>
          </>
        )}
      </div>

      {isAddModalOpen && (
        <AddCommitmentModal
          teammateId={teammateId}
          onSuccess={handleAddSuccess}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-md shadow-lg">
          {toastMessage}
        </div>
      )}
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(CommitmentsPage, async (ctx: GetServerSidePropsContext, managerId: string) => {
  const { prisma } = await import('@/lib/prisma')
  const id = ctx.params?.id as string

  const [teammate, manager] = await Promise.all([
    prisma.teammate.findFirst({ where: { id, managerId }, select: { name: true } }),
    prisma.manager.findUnique({ where: { id: managerId }, select: { email: true } }),
  ])

  if (!teammate) return { notFound: true }

  return {
    props: {
      teammateName: teammate.name,
      teammateId: id,
      managerEmail: manager?.email ?? '',
    },
  }
})
export default _page
export const getServerSideProps = _getServerSideProps
