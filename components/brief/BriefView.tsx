import CommitmentListMini from './CommitmentListMini'
import PatternSignals from './PatternSignals'
import CoachingApproachCard from './CoachingApproachCard'
import QuestionList from './QuestionList'

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

function formatBriefAsText(brief: Brief, teammateName: string): string {
  const lines: string[] = [
    `PRE-MEETING BRIEF — ${teammateName}`,
    `Generated: ${new Date(brief.generatedAt).toLocaleDateString()}`,
    '',
    '--- CONTEXT SUMMARY ---',
    brief.contextSummary,
    '',
  ]

  if (brief.riskSignals.length > 0) {
    lines.push('--- RISK SIGNALS ---')
    lines.push(...brief.riskSignals.map((r) => `⚠ ${r}`))
    lines.push('')
  }

  lines.push(
    '--- OPEN COMMITMENTS ---',
    ...(brief.openCommitments.length > 0
      ? brief.openCommitments.map(
          (c, i) =>
            `${i + 1}. [${c.owner}] ${c.text} (${c.status}${c.carryCount >= 2 ? ` — carried ${c.carryCount}x` : ''})`
        )
      : ['None.']),
    '',
    '--- ACTIVE PATTERNS ---',
    ...(brief.patterns.length > 0
      ? brief.patterns.map((p) => `• [${p.severity}] ${p.description}`)
      : ['No active patterns.']),
    '',
    '--- COACHING FOCUS ---',
    brief.coachingFocus,
    '',
    '--- COACHING APPROACH ---',
    `Framework: ${brief.coachingApproach.framework}`,
    brief.coachingApproach.rationale,
    ...brief.coachingApproach.actions.map((a) => `• ${a}`),
    '',
    '--- FOLLOW-UP QUESTIONS ---',
    ...brief.followUpQuestions.map((q, i) => `${i + 1}. ${q}`),
    '',
    '--- THE UNCOMFORTABLE QUESTION ---',
    brief.uncomfortableQuestion,
  )

  return lines.join('\n')
}

interface BriefViewProps {
  brief: Brief
  teammateName: string
  onRegenerate: () => void
  isRegenerating: boolean
  showToast: (msg: string) => void
}

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

export default function BriefView({ brief, teammateName, onRegenerate, isRegenerating, showToast }: BriefViewProps) {
  async function handleCopy() {
    const text = formatBriefAsText(brief as Parameters<typeof formatBriefAsText>[0], teammateName)
    await navigator.clipboard.writeText(text)
    showToast('Brief copied.')
  }

  return (
    <div data-testid="brief-view" className={`space-y-6 ${isRegenerating ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-400">
          Generated {new Date(brief.generatedAt).toLocaleString()}
        </p>
        <div className="flex gap-2">
          <button
            data-testid="brief-copy-btn"
            onClick={handleCopy}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Copy to Clipboard
          </button>
          <button
            data-testid="brief-regenerate-btn"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isRegenerating ? 'Regenerating…' : 'Regenerate Brief'}
          </button>
        </div>
      </div>

      {/* Context Summary */}
      <BriefSection title="Context Summary">
        <p data-testid="brief-context-summary" className="text-sm text-gray-800">
          {brief.contextSummary}
        </p>
      </BriefSection>

      {/* Open Commitments */}
      <BriefSection title="Open Commitments">
        <CommitmentListMini commitments={brief.openCommitments} />
      </BriefSection>

      {/* Active Pattern Signals */}
      <BriefSection title="Active Pattern Signals">
        <PatternSignals patterns={brief.patterns} />
      </BriefSection>

      {/* Risk Signals — conditional */}
      {brief.riskSignals.length > 0 && (
        <BriefSection title="Risk Signals">
          <ul className="space-y-1">
            {brief.riskSignals.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-red-700">
                <span className="shrink-0">⚠</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </BriefSection>
      )}

      {/* Coaching Focus */}
      <BriefSection title="Suggested Coaching Focus">
        <p data-testid="brief-coaching-focus" className="text-sm text-gray-800">
          {brief.coachingFocus}
        </p>
      </BriefSection>

      {/* Coaching Approach */}
      <BriefSection title="Coaching Approach">
        <CoachingApproachCard approach={brief.coachingApproach} />
      </BriefSection>

      {/* Follow-Up Questions */}
      <BriefSection title="Follow-Up Questions">
        <QuestionList questions={brief.followUpQuestions} />
      </BriefSection>

      {/* The Uncomfortable Question */}
      <BriefSection title="The Uncomfortable Question">
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <p data-testid="brief-uncomfortable-question" className="text-sm font-medium text-gray-900 italic">
            "{brief.uncomfortableQuestion}"
          </p>
        </div>
      </BriefSection>
    </div>
  )
}
