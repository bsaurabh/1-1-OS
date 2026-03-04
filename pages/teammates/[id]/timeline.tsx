import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import type { NextPage, GetServerSidePropsContext } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import TimelineList from '@/components/timeline/TimelineList'
import TagFilter from '@/components/timeline/TagFilter'
import GrowthSummaryPanel from '@/components/timeline/GrowthSummaryPanel'
import { withAuth, WithAuthProps } from '@/lib/withAuth'

interface TimelineMeetingEntry {
  id: string
  summary: string | null
  tags: string[]
  tone: string | null
  status: string
  createdAt: string
}

interface GrowthSummary {
  teammateName: string
  generatedAt: string
  narrative: string
  keyThemes: string[]
  growthSignals: string[]
  coachingGaps: string[]
}

interface TimelinePageProps extends WithAuthProps {
  managerEmail: string
  teammateName: string
  teammateId: string
}

const TimelinePage: NextPage<TimelinePageProps> = ({ managerEmail, teammateName, teammateId }) => {
  const router = useRouter()

  const [meetings, setMeetings] = useState<TimelineMeetingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [summary, setSummary] = useState<GrowthSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryAttempted, setSummaryAttempted] = useState(false)

  // P-5.05: client-side collection filter — derived from fetched data, no refetch
  const filteredMeetings = useMemo(() => {
    if (!activeTag) return meetings
    return meetings.filter((m) => m.tags.includes(activeTag))
  }, [meetings, activeTag])

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    meetings.forEach((m) => m.tags.forEach((t) => tagSet.add(t)))
    return [...tagSet].sort()
  }, [meetings])

  useEffect(() => {
    async function loadMeetings() {
      setLoading(true)
      try {
        const res = await fetch(`/api/timeline/${teammateId}`)
        const data = await res.json()
        setMeetings(data.meetings ?? [])
      } catch (err) {
        console.error('[timeline] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    loadMeetings()
  }, [teammateId])

  const handleGenerateSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryAttempted(true)
    try {
      const res = await fetch(`/api/timeline/${teammateId}/summary`, { method: 'POST' })
      if (res.status === 422) {
        setSummary(null)
        return
      }
      const data = await res.json()
      setSummary(data.summary ?? null)
    } catch (err) {
      console.error('[timeline] summary error:', err)
      setSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [teammateId])

  return (
    <AppLayout managerEmail={managerEmail}>
      <div data-testid="timeline-page" className="max-w-2xl mx-auto py-8 px-4">
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
            { label: 'Timeline', href: `/teammates/${teammateId}/timeline`, testid: 'tab-timeline', active: true },
            { label: 'Commitments', href: `/teammates/${teammateId}/commitments`, testid: 'tab-commitments' },
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

        <h1 className="text-lg font-semibold text-gray-900 mb-4">Growth Timeline — {teammateName}</h1>

        {/* Growth summary panel */}
        <GrowthSummaryPanel
          summary={summary}
          isLoading={summaryLoading}
          hasAttempted={summaryAttempted}
          onGenerate={handleGenerateSummary}
        />

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* P-5.05: tag filter — instant, client-side */}
            <TagFilter
              availableTags={availableTags}
              activeTag={activeTag}
              onTagSelect={setActiveTag}
            />

            <TimelineList meetings={filteredMeetings} activeTag={activeTag} />
          </>
        )}
      </div>
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(TimelinePage, async (ctx: GetServerSidePropsContext, managerId: string) => {
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
