import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import type { NextPage, GetServerSidePropsContext } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import BriefView from '@/components/brief/BriefView'
import BriefFallbackView from '@/components/brief/BriefFallbackView'
import { withAuth, WithAuthProps } from '@/lib/withAuth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BriefCommitment {
  text: string
  owner: 'MANAGER' | 'TEAMMATE'
  status: 'OPEN' | 'CARRIED_FORWARD'
  carryCount: number
}

interface BriefPattern {
  description: string
  severity: 'WATCH' | 'ACTION_REQUIRED'
  meetingCount: number
}

interface CoachingApproach {
  framework: string
  rationale: string
  actions: string[]
}

interface Brief {
  teammateId: string
  generatedAt: string
  contextSummary: string
  openCommitments: BriefCommitment[]
  patterns: BriefPattern[]
  coachingFocus: string
  riskSignals: string[]
  followUpQuestions: string[]
  uncomfortableQuestion: string
  coachingApproach: CoachingApproach
}

interface BriefFallback {
  commitments: BriefCommitment[]
  lastMeetingSummary: string | null
  lastMeetingDate: string | null
}

interface BriefPageProps extends WithAuthProps {
  managerEmail: string
  teammateName: string
  teammateId: string
}

// ─── Page component ───────────────────────────────────────────────────────────

const BriefPage: NextPage<BriefPageProps> = ({ managerEmail, teammateName, teammateId }) => {
  const router = useRouter()

  const [brief, setBrief] = useState<Brief | null>(null)
  const [fallback, setFallback] = useState<BriefFallback | null>(null)
  const [loading, setLoading] = useState(true)
  const [noHistory, setNoHistory] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    setBrief(null)
    setFallback(null)
    setNoHistory(false)

    try {
      const res = await fetch(`/api/brief/${teammateId}/generate`, { method: 'POST' })

      if (res.status === 422) {
        setNoHistory(true)
        return
      }

      const data = await res.json()
      if (data.brief) {
        setBrief(data.brief)
      } else if (data.fallback) {
        setFallback(data.fallback)
      }
    } catch (err) {
      console.error('[brief] generate error:', err)
      setFallback({ commitments: [], lastMeetingSummary: null, lastMeetingDate: null })
    } finally {
      setLoading(false)
      setIsRegenerating(false)
    }
  }, [teammateId])

  // P-4.06: trigger generation on mount (SSR renders shell only)
  useEffect(() => {
    handleGenerate()
  }, [handleGenerate])

  function handleRegenerate() {
    setIsRegenerating(true)
    handleGenerate()
  }

  function showToast(msg: string) {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  return (
    <AppLayout managerEmail={managerEmail}>
      <div data-testid="brief-page" className="max-w-2xl mx-auto py-8 px-4">
        {/* Back nav */}
        <div className="mb-6">
          <button
            onClick={() => router.push(`/teammates/${teammateId}`)}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to profile
          </button>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-6">
          Pre-Meeting Brief — {teammateName}
        </h1>

        {/* Loading state */}
        {loading && (
          <div data-testid="brief-loading" className="flex flex-col items-center py-16 text-gray-500">
            <div className="w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mb-3" />
            <p className="text-sm">Generating your brief…</p>
          </div>
        )}

        {/* No history state */}
        {!loading && noHistory && (
          <div data-testid="brief-no-history" className="rounded-lg bg-gray-50 border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-600 mb-3">
              No meeting history yet. Complete at least one meeting to generate a brief.
            </p>
            <button
              onClick={() => router.push(`/teammates/${teammateId}`)}
              className="text-sm text-indigo-600 hover:underline"
            >
              Go to profile to add a meeting
            </button>
          </div>
        )}

        {/* Brief view */}
        {!loading && brief && (
          <BriefView
            brief={brief}
            teammateName={teammateName}
            onRegenerate={handleRegenerate}
            isRegenerating={isRegenerating}
            showToast={showToast}
          />
        )}

        {/* Fallback view */}
        {!loading && fallback && (
          <BriefFallbackView fallback={fallback} onRetry={handleGenerate} />
        )}
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-md shadow-lg">
          {toastMessage}
        </div>
      )}
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(BriefPage, async (ctx: GetServerSidePropsContext, managerId: string) => {
  const { prisma } = await import('@/lib/prisma')
  const { prisma: _p, ...rest } = { prisma }
  void rest

  const id = ctx.params?.id as string

  const [teammate, manager] = await Promise.all([
    prisma.teammate.findFirst({
      where: { id, managerId },
      select: { name: true },
    }),
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
