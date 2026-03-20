import Anthropic from '@anthropic-ai/sdk'
import type { ComputedMetrics } from '@/lib/excel/metrics'

export const INSIGHTS_MODEL = 'claude-sonnet-4-6'

export interface InsightsResult {
  insights: string[]
  recommendations: string[]
}

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export function buildInsightsPrompt(metrics: ComputedMetrics, rowCount: number): string {
  const { delivery, time, business, throughput } = metrics

  const lines = [
    `You are a data analyst helping a Design Manager understand their project delivery data.`,
    ``,
    `Dataset: ${rowCount} items`,
    ``,
    `DELIVERY METRICS:`,
    `- Status breakdown: ${JSON.stringify(delivery.byStatus)}`,
    `- Size breakdown: ${JSON.stringify(delivery.bySize)}`,
    `- Completion rate: ${delivery.completionRate}%`,
    ``,
  ]

  if (time.avgTurnaroundDays !== null) {
    lines.push(`TIME METRICS:`)
    lines.push(`- Avg turnaround: ${time.avgTurnaroundDays} days`)
    lines.push(`- By size: ${JSON.stringify(time.avgTurnaroundBySize)}`)
    lines.push(`- Items with delays (>1.5x avg): ${time.itemsWithDelays}`)
    lines.push(``)
  }

  if (business.totalRevenue > 0) {
    lines.push(`BUSINESS IMPACT:`)
    lines.push(`- Total revenue: $${business.totalRevenue.toLocaleString()}`)
    lines.push(`- Revenue per completed item: $${business.revenuePerItem?.toLocaleString() ?? 'N/A'}`)
    lines.push(`- Monthly revenue: ${JSON.stringify(business.revenueByMonth)}`)
    lines.push(``)
  }

  lines.push(`THROUGHPUT:`)
  lines.push(`- Completed by month: ${JSON.stringify(throughput.completedByMonth)}`)
  lines.push(`- Velocity trend: ${throughput.velocityTrend}`)
  lines.push(``)

  lines.push(
    `Based on this data, generate a JSON object with exactly these two keys:`,
    `{`,
    `  "insights": [<3 to 7 specific, actionable insight strings ranked by significance>],`,
    `  "recommendations": [<0 to 5 recommendation strings for missing or improvable data>]`,
    `}`,
    ``,
    `Rules:`,
    `- insights: Specific and quantified. Bad: "Throughput dropped". Good: "February throughput dropped 40% vs January — potential bandwidth issue or holiday effect."`,
    `- recommendations: Only for genuinely missing or low-quality data fields. E.g. "Add 'Start Date' to accurately track turnaround time."`,
    `- Return ONLY valid JSON. No markdown fences, no prose.`,
  )

  return lines.join('\n')
}

export async function generateInsights(
  metrics: ComputedMetrics,
  rowCount: number
): Promise<InsightsResult> {
  const client = getClient()
  const prompt = buildInsightsPrompt(metrics, rowCount)

  const message = await client.messages.create({
    model: INSIGHTS_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '{}'
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')

  let parsed: { insights?: unknown; recommendations?: unknown }
  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    parsed = match ? JSON.parse(match[0]) : {}
  }

  return {
    insights: Array.isArray(parsed.insights)
      ? (parsed.insights as unknown[]).filter((s): s is string => typeof s === 'string')
      : [],
    recommendations: Array.isArray(parsed.recommendations)
      ? (parsed.recommendations as unknown[]).filter((s): s is string => typeof s === 'string')
      : [],
  }
}
