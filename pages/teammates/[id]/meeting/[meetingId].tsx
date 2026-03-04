import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { NextPage, GetServerSidePropsContext } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import AnalysisPendingBanner from '@/components/meetings/AnalysisPendingBanner'
import MeetingAnalysisResults from '@/components/meetings/MeetingAnalysisResults'
import SuggestedCommitments from '@/components/commitments/SuggestedCommitments'
import { withAuth, WithAuthProps } from '@/lib/withAuth'

interface Meeting {
  id: string
  status: 'PENDING_ANALYSIS' | 'ANALYSIS_COMPLETE' | 'ANALYSIS_FAILED'
  summary: string | null
  tone: string | null
  tags: string[]
  themes: unknown
  source: 'PASTE' | 'UPLOAD' | 'VOICE'
  createdAt: string
}

interface Commitment {
  id: string
  text: string
  owner: 'MANAGER' | 'TEAMMATE'
  status: string
}

interface MeetingPageProps extends WithAuthProps {
  managerEmail: string
  initialMeeting: Meeting
  initialCommitments: Commitment[]
  teammateId: string
}

const POLL_INTERVAL_MS = 5000

const MeetingPage: NextPage<MeetingPageProps> = ({
  managerEmail,
  initialMeeting,
  initialCommitments,
  teammateId,
}) => {
  const router = useRouter()
  const [meeting, setMeeting] = useState<Meeting>(initialMeeting)
  const [commitments, setCommitments] = useState<Commitment[]>(initialCommitments)

  useEffect(() => {
    if (meeting.status !== 'PENDING_ANALYSIS') return

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/meetings/${teammateId}/${meeting.id}`)
        if (!res.ok) return
        const data = await res.json()
        setMeeting(data.meeting)
        setCommitments(data.commitments)
      } catch {
        // ignore transient fetch errors
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [meeting.status, meeting.id, teammateId])

  return (
    <AppLayout managerEmail={managerEmail}>
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/teammates/${teammateId}`)}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to profile
          </button>
        </div>

        <h1 className="text-xl font-semibold text-gray-900">Meeting Analysis</h1>

        {meeting.status === 'PENDING_ANALYSIS' && <AnalysisPendingBanner />}

        {meeting.status === 'ANALYSIS_FAILED' && (
          <div
            data-testid="analysis-failed-banner"
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            Analysis failed after multiple attempts. Please try submitting your notes again.
          </div>
        )}

        {meeting.status === 'ANALYSIS_COMPLETE' && (
          <>
            <MeetingAnalysisResults
              summary={meeting.summary ?? ''}
              tone={meeting.tone ?? 'neutral'}
              tags={meeting.tags}
              themes={Array.isArray(meeting.themes) ? (meeting.themes as string[]) : []}
              source={meeting.source}
            />

            {commitments.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3">
                  Suggested Commitments
                </h2>
                <SuggestedCommitments
                  commitments={commitments}
                  onChange={setCommitments}
                />
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(
  MeetingPage,
  async (ctx: GetServerSidePropsContext, managerId: string) => {
    const { prisma } = await import('@/lib/prisma')
    const { listSuggested } = await import('@/lib/commitments')

    const teammateId = ctx.params?.id as string
    const meetingId = ctx.params?.meetingId as string

    const [meeting, manager] = await Promise.all([
      prisma.meeting.findFirst({
        where: { id: meetingId, managerId, teammateId },
        select: {
          id: true,
          status: true,
          summary: true,
          tone: true,
          tags: true,
          themes: true,
          source: true,
          createdAt: true,
        },
      }),
      prisma.manager.findUnique({ where: { id: managerId }, select: { email: true } }),
    ])

    if (!meeting) return { notFound: true }

    const commitments = await listSuggested(managerId, teammateId)

    return {
      props: {
        initialMeeting: { ...meeting, createdAt: meeting.createdAt.toISOString() },
        initialCommitments: JSON.parse(JSON.stringify(commitments)),
        managerEmail: manager?.email ?? '',
        teammateId,
      },
    }
  }
)
export default _page
export const getServerSideProps = _getServerSideProps
