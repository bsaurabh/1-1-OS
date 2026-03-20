import { useRouter } from 'next/router'
import type { NextPage, GetServerSidePropsContext } from 'next'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import InsightCards from '@/components/insights/InsightCards'
import RecommendationCards from '@/components/insights/RecommendationCards'
import MetricsDashboard from '@/components/insights/MetricsDashboard'
import ExportButton from '@/components/insights/ExportButton'
import { withAuth, WithAuthProps } from '@/lib/withAuth'
import type { ComputedMetrics } from '@/lib/excel/metrics'

interface Analysis {
  id: string
  filename: string
  sheetName: string | null
  rowCount: number
  analysedAt: string
  metrics: ComputedMetrics
  insights: string[]
  recommendations: string[]
}

interface InsightsDashboardProps extends WithAuthProps {
  managerEmail: string
  analysis: Analysis | null
}

const InsightsDashboardPage: NextPage<InsightsDashboardProps> = ({ managerEmail, analysis }) => {
  const router = useRouter()

  if (!analysis) {
    return (
      <AppLayout managerEmail={managerEmail}>
        <div className="max-w-3xl mx-auto py-16 px-4 text-center text-gray-500">
          <p>Analysis not found.</p>
          <Link href="/insights" className="mt-4 inline-block text-indigo-600 text-sm hover:underline">Back to Insights</Link>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout managerEmail={managerEmail}>
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/insights" className="text-xs text-indigo-600 hover:underline">← Back to Insights</Link>
            <h1 className="text-xl font-semibold text-gray-900 mt-1">{analysis.filename}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {analysis.rowCount} rows · {analysis.sheetName ?? 'Sheet 1'} · Analysed {new Date(analysis.analysedAt).toLocaleDateString()}
            </p>
          </div>
          <ExportButton analysisId={analysis.id} />
        </div>

        {/* Insights first */}
        <InsightCards insights={analysis.insights} />

        {/* Dashboard */}
        <MetricsDashboard metrics={analysis.metrics} />

        {/* Recommendations last */}
        <RecommendationCards recommendations={analysis.recommendations} />
      </div>
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(InsightsDashboardPage, async (ctx: GetServerSidePropsContext, managerId: string) => {
  const id = ctx.params?.id as string
  const { prisma } = await import('@/lib/prisma')

  const [manager, record] = await Promise.all([
    prisma.manager.findUnique({ where: { id: managerId }, select: { email: true } }),
    prisma.excelAnalysis.findUnique({ where: { id } }),
  ])

  if (!record || record.managerId !== managerId) {
    return { props: { managerEmail: manager?.email ?? '', analysis: null } }
  }

  const analysis: Analysis = {
    id: record.id,
    filename: record.filename,
    sheetName: record.sheetName,
    rowCount: record.rowCount,
    analysedAt: record.analysedAt.toISOString(),
    metrics: record.metrics as unknown as ComputedMetrics,
    insights: record.insights as unknown as string[],
    recommendations: record.recommendations as unknown as string[],
  }

  return { props: { managerEmail: manager?.email ?? '', analysis } }
})
export default _page
export const getServerSideProps = _getServerSideProps
