import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import type { NextPage, GetServerSidePropsContext } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import ProfileView from '@/components/teammates/ProfileView'
import MeetingInputModal from '@/components/meetings/MeetingInputModal'
import PatternList from '@/components/patterns/PatternList'
import { withAuth, WithAuthProps } from '@/lib/withAuth'
import type { TeammateDetail } from '@/lib/teammates'

interface Pattern {
  id: string
  description: string
  severity: 'INFORMATIONAL' | 'WATCH' | 'ACTION_REQUIRED'
  evidence: { meetingIds: string[]; dates: string[]; tags: string[] }
  detectedAt: string
}

interface ProfilePageProps extends WithAuthProps {
  managerEmail: string
  teammate:     TeammateDetail
  startInEdit:  boolean
  patterns:     Pattern[]
  meetingCount: number
}

const ProfilePage: NextPage<ProfilePageProps> = ({ managerEmail, teammate: initial, startInEdit, patterns, meetingCount }) => {
  const router  = useRouter()
  const [teammate, setTeammate] = useState<TeammateDetail>(initial)

  // Show save toast
  const [showToast, setShowToast] = useState(false)

  // Meeting modal
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false)

  function handleMeetingSuccess(meetingId: string) {
    setIsMeetingModalOpen(false)
    router.push(`/teammates/${teammate.id}/meeting/${meetingId}`)
  }

  function handleSaved(updated: TeammateDetail) {
    setTeammate(updated)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  async function handleDelete() {
    await fetch(`/api/teammates/${teammate.id}`, { method: 'DELETE' })
    router.replace('/dashboard')
  }

  function handleReinterview() {
    router.push(`/teammates/${teammate.id}/interview`)
  }

  return (
    <AppLayout managerEmail={managerEmail}>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to team
          </button>
          <button
            data-testid="add-meeting-button"
            onClick={() => setIsMeetingModalOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add Meeting
          </button>
        </div>

        {/* Tab navigation (Unit 5) */}
        <nav data-testid="teammate-tabs" className="flex gap-1 mb-6 border-b border-gray-200">
          {[
            { label: 'Profile', href: `/teammates/${teammate.id}`, testid: 'tab-profile', active: true },
            { label: 'Timeline', href: `/teammates/${teammate.id}/timeline`, testid: 'tab-timeline' },
            { label: 'Commitments', href: `/teammates/${teammate.id}/commitments`, testid: 'tab-commitments' },
            { label: 'Brief', href: `/teammates/${teammate.id}/brief`, testid: 'tab-brief' },
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

        <ProfileView
          teammate={teammate}
          onDelete={handleDelete}
          onReinterview={handleReinterview}
          onSaved={handleSaved}
        />

        {/* Observed patterns (US-09) */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Observed Patterns</h2>
          <PatternList patterns={patterns} meetingCount={meetingCount} />
        </div>
      </div>

      {/* Meeting input modal */}
      {isMeetingModalOpen && (
        <MeetingInputModal
          teammateId={teammate.id}
          onSuccess={handleMeetingSuccess}
          onClose={() => setIsMeetingModalOpen(false)}
        />
      )}

      {/* Success toast */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-md shadow-lg">
          Profile saved.
        </div>
      )}
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(ProfilePage, async (ctx: GetServerSidePropsContext, managerId: string) => {
  const { getTeammate } = await import('@/lib/teammates')
  const { prisma } = await import('@/lib/prisma')
  const id = ctx.params?.id as string

  // LC-4.05: parallel DB reads — teammate, manager, patterns, meeting count
  const [teammate, manager, rawPatterns, meetingCount] = await Promise.all([
    getTeammate(managerId, id),
    prisma.manager.findUnique({ where: { id: managerId }, select: { email: true } }),
    prisma.pattern.findMany({
      where: { teammateId: id },
      orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
      select: { id: true, description: true, severity: true, evidence: true, detectedAt: true },
    }),
    prisma.meeting.count({ where: { teammateId: id, managerId } }),
  ])

  if (!teammate) return { notFound: true }

  const startInEdit = ctx.query.editMode === '1'

  const patterns = rawPatterns.map((p) => ({
    id: p.id,
    description: p.description,
    severity: p.severity as 'INFORMATIONAL' | 'WATCH' | 'ACTION_REQUIRED',
    evidence: p.evidence as { meetingIds: string[]; dates: string[]; tags: string[] },
    detectedAt: p.detectedAt.toISOString(),
  }))

  return {
    props: {
      teammate,
      managerEmail: manager?.email ?? '',
      startInEdit,
      patterns,
      meetingCount,
    },
  }
})
export default _page
export const getServerSideProps = _getServerSideProps
