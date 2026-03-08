import { useState, useRef, useEffect } from 'react'

interface CritiqueIssue {
  category: string
  title: string
  description: string
  userImpact: string
  suggestedFix: string
  location: {
    screenshotIndex: number
    x: number
    y: number
  } | null
}

interface CritiqueResult {
  executiveSummary: {
    clarityScore: number
    primaryRisk: string
    primaryOpportunity: string
  }
  criticalIssues: CritiqueIssue[]
  uxImprovements: CritiqueIssue[]
  visualCraftFeedback: CritiqueIssue[]
  accessibilityIssues: CritiqueIssue[]
  productThinking: CritiqueIssue[]
  missedOpportunities: string[]
  questionsForDesigner: string[]
  coachingInsight: string | null
}

interface Props {
  result: CritiqueResult
  featureName: string
  imageUrls: string[]
  onRegenerate: () => void
  isRegenerating: boolean
}

type ViewMode = 'annotated' | 'list'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { pin: string; bg: string; border: string; text: string; ring: string }> = {
  CRITICAL: { pin: 'bg-red-500', bg: 'bg-red-50', border: 'border-l-red-500', text: 'text-red-700', ring: 'ring-red-400' },
  UX_IMPROVEMENT: { pin: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700', ring: 'ring-amber-400' },
  VISUAL_CRAFT: { pin: 'bg-indigo-500', bg: 'bg-indigo-50', border: 'border-l-indigo-500', text: 'text-indigo-700', ring: 'ring-indigo-400' },
  ACCESSIBILITY: { pin: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-l-purple-500', text: 'text-purple-700', ring: 'ring-purple-400' },
  PRODUCT_THINKING: { pin: 'bg-blue-500', bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-700', ring: 'ring-blue-400' },
}

const CATEGORY_LABELS: Record<string, string> = {
  CRITICAL: 'Critical',
  UX_IMPROVEMENT: 'UX',
  VISUAL_CRAFT: 'Visual',
  ACCESSIBILITY: 'A11y',
  PRODUCT_THINKING: 'Product',
}

function getAllIssues(result: CritiqueResult): CritiqueIssue[] {
  return [
    ...result.criticalIssues,
    ...result.uxImprovements,
    ...result.visualCraftFeedback,
    ...result.accessibilityIssues,
    ...result.productThinking,
  ]
}

// ─── Score Ring ──────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-500' : 'text-red-500'
  const bgColor = score >= 80 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  return (
    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full border-2 ${bgColor}`}>
      <span className={`text-lg font-bold ${color}`}>{score}</span>
    </div>
  )
}

// ─── Annotation Pin ──────────────────────────────────────────────────────────

function AnnotationPin({
  index,
  issue,
  isActive,
  onClick,
}: {
  index: number
  issue: CritiqueIssue
  isActive: boolean
  onClick: () => void
}) {
  const colors = CATEGORY_COLORS[issue.category] || CATEGORY_COLORS.CRITICAL

  return (
    <button
      onClick={onClick}
      className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 group ${
        isActive ? 'z-20 scale-125' : 'hover:scale-110'
      }`}
      style={{
        left: `${issue.location!.x}%`,
        top: `${issue.location!.y}%`,
      }}
      title={issue.title}
    >
      {/* Pulse ring when active */}
      {isActive && (
        <span className={`absolute inset-0 -m-1 rounded-full ${colors.ring} ring-2 animate-ping opacity-50`} />
      )}
      {/* Pin circle */}
      <span
        className={`flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold shadow-lg border-2 border-white ${colors.pin} ${
          isActive ? 'ring-2 ' + colors.ring : ''
        }`}
      >
        {index + 1}
      </span>
    </button>
  )
}

// ─── Issue Card (sidebar) ────────────────────────────────────────────────────

function IssueCard({
  issue,
  index,
  isActive,
  onClick,
}: {
  issue: CritiqueIssue
  index: number
  isActive: boolean
  onClick: () => void
}) {
  const colors = CATEGORY_COLORS[issue.category] || CATEGORY_COLORS.CRITICAL
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isActive])

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={`border-l-4 rounded-r-md p-3 cursor-pointer transition-all duration-200 ${colors.border} ${
        isActive ? colors.bg + ' shadow-md ring-1 ' + colors.ring : 'bg-white hover:' + colors.bg
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold ${colors.pin}`}
        >
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-semibold text-gray-900 truncate">{issue.title}</h4>
            <span className={`text-[9px] font-semibold uppercase tracking-wide ${colors.text} whitespace-nowrap`}>
              {CATEGORY_LABELS[issue.category] || issue.category}
            </span>
          </div>
          {isActive ? (
            <div className="mt-1.5 space-y-1.5">
              <p className="text-sm text-gray-700">{issue.description}</p>
              <p className="text-xs text-gray-500">
                <span className="font-medium">Impact:</span> {issue.userImpact}
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-medium">Fix:</span> {issue.suggestedFix}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500 line-clamp-1">{issue.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Annotated Screenshot View ───────────────────────────────────────────────

function AnnotatedView({
  result,
  imageUrls,
  activeIndex,
  setActiveIndex,
}: {
  result: CritiqueResult
  imageUrls: string[]
  activeIndex: number | null
  setActiveIndex: (i: number | null) => void
}) {
  const allIssues = getAllIssues(result)
  const [activeScreenshot, setActiveScreenshot] = useState(0)

  const issuesForCurrentScreen = allIssues
    .map((issue, globalIndex) => ({ issue, globalIndex }))
    .filter(({ issue }) => {
      if (!issue.location) return activeScreenshot === 0
      return issue.location.screenshotIndex === activeScreenshot
    })

  return (
    <div className="flex gap-4" style={{ minHeight: '500px' }}>
      {/* Screenshot panel */}
      <div className="flex-1 min-w-0">
        {/* Screenshot tabs if multiple */}
        {imageUrls.length > 1 && (
          <div className="flex gap-2 mb-3">
            {imageUrls.map((_, i) => (
              <button
                key={i}
                onClick={() => { setActiveScreenshot(i); setActiveIndex(null) }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeScreenshot === i
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                Screen {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Screenshot with pins */}
        <div
          className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-100 shadow-inner"
          onClick={(e) => {
            // Click on empty space deselects
            if (e.target === e.currentTarget) setActiveIndex(null)
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrls[activeScreenshot]}
            alt={`Screenshot ${activeScreenshot + 1}`}
            className="w-full h-auto block"
            onClick={() => setActiveIndex(null)}
          />

          {/* Annotation pins */}
          {issuesForCurrentScreen.map(({ issue, globalIndex }) =>
            issue.location ? (
              <AnnotationPin
                key={globalIndex}
                index={globalIndex}
                issue={issue}
                isActive={activeIndex === globalIndex}
                onClick={() => setActiveIndex(activeIndex === globalIndex ? null : globalIndex)}
              />
            ) : null
          )}

          {/* Floating detail card when pin is active */}
          {activeIndex !== null && allIssues[activeIndex]?.location && (
            <FloatingDetail issue={allIssues[activeIndex]} index={activeIndex} />
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const count = allIssues.filter((i) => i.category === key).length
            if (count === 0) return null
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[key].pin}`} />
                <span className="text-xs text-gray-500">{label} ({count})</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Issue sidebar */}
      <div className="w-80 flex-shrink-0 overflow-y-auto max-h-[700px] space-y-2 pr-1">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
          {allIssues.length} Issues Found
        </p>
        {allIssues.map((issue, i) => (
          <IssueCard
            key={i}
            issue={issue}
            index={i}
            isActive={activeIndex === i}
            onClick={() => setActiveIndex(activeIndex === i ? null : i)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Floating Detail (shows near pin on screenshot) ──────────────────────────

function FloatingDetail({ issue, index }: { issue: CritiqueIssue; index: number }) {
  const colors = CATEGORY_COLORS[issue.category] || CATEGORY_COLORS.CRITICAL
  if (!issue.location) return null

  // Position the card near the pin but keep it readable
  const isLeftSide = issue.location.x < 50
  const isTopSide = issue.location.y < 50

  return (
    <div
      className={`absolute z-30 w-72 rounded-lg shadow-xl border border-gray-200 bg-white p-3 pointer-events-none`}
      style={{
        left: isLeftSide ? `${issue.location.x + 3}%` : undefined,
        right: !isLeftSide ? `${100 - issue.location.x + 3}%` : undefined,
        top: isTopSide ? `${issue.location.y + 3}%` : undefined,
        bottom: !isTopSide ? `${100 - issue.location.y + 3}%` : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${colors.pin}`}>
          {index + 1}
        </span>
        <h4 className="text-sm font-semibold text-gray-900">{issue.title}</h4>
      </div>
      <p className="text-xs text-gray-600 mb-1.5">{issue.description}</p>
      <p className="text-xs text-gray-400">
        <span className="font-medium">Fix:</span> {issue.suggestedFix}
      </p>
    </div>
  )
}

// ─── List View (classic) ─────────────────────────────────────────────────────

function ListView({ result }: { result: CritiqueResult }) {
  return (
    <div>
      <ListSection title="Critical Issues" issues={result.criticalIssues} />
      <ListSection title="UX Improvements" issues={result.uxImprovements} />
      <ListSection title="Visual Craft Feedback" issues={result.visualCraftFeedback} />
      <ListSection title="Accessibility Issues" issues={result.accessibilityIssues} />
      <ListSection title="Product Thinking" issues={result.productThinking} />
    </div>
  )
}

function ListSection({ title, issues }: { title: string; issues: CritiqueIssue[] }) {
  if (issues.length === 0) return null
  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        {title} <span className="text-gray-400 font-normal">({issues.length})</span>
      </h3>
      <div className="space-y-3">
        {issues.map((issue, i) => {
          const colors = CATEGORY_COLORS[issue.category] || CATEGORY_COLORS.CRITICAL
          return (
            <div key={i} className={`border-l-4 rounded-r-md p-4 ${colors.border} ${colors.bg}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="text-sm font-semibold text-gray-900">{issue.title}</h4>
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap">
                  {CATEGORY_LABELS[issue.category] || issue.category}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{issue.description}</p>
              <div className="space-y-1">
                <p className="text-xs text-gray-500"><span className="font-medium">User impact:</span> {issue.userImpact}</p>
                <p className="text-xs text-gray-500"><span className="font-medium">Suggested fix:</span> {issue.suggestedFix}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CritiqueResultView({ result, featureName, imageUrls, onRegenerate, isRegenerating }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(imageUrls.length > 0 ? 'annotated' : 'list')
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const totalIssues = getAllIssues(result).length

  return (
    <div data-testid="critique-result">
      {/* Executive Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-5">
        <div className="flex items-start gap-4">
          <ScoreRing score={result.executiveSummary.clarityScore} />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-0.5">
                  {featureName}
                </h2>
                <p className="text-xs text-gray-500">{totalIssues} issues found</p>
              </div>

              {/* View toggle */}
              {imageUrls.length > 0 && (
                <div className="flex bg-gray-100 rounded-md p-0.5">
                  <button
                    onClick={() => setViewMode('annotated')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      viewMode === 'annotated'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      Annotated
                    </span>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      List
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-red-50 border border-red-100 rounded-md p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400 mb-0.5">Risk</p>
                <p className="text-xs text-red-800">{result.executiveSummary.primaryRisk}</p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-md p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-green-400 mb-0.5">Opportunity</p>
                <p className="text-xs text-green-800">{result.executiveSummary.primaryOpportunity}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      {viewMode === 'annotated' && imageUrls.length > 0 ? (
        <AnnotatedView
          result={result}
          imageUrls={imageUrls}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
        />
      ) : (
        <ListView result={result} />
      )}

      {/* Missed Opportunities */}
      {result.missedOpportunities.length > 0 && (
        <div className="mt-8 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Missed Opportunities
          </h3>
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 space-y-2">
            {result.missedOpportunities.map((opp, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">&#9679;</span>
                <p className="text-sm text-amber-900">{opp}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Questions for Designer */}
      {result.questionsForDesigner.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Questions for the Designer
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-2">
            {result.questionsForDesigner.map((q, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-blue-500 font-mono text-xs mt-0.5">{i + 1}.</span>
                <p className="text-sm text-blue-900">{q}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Coaching Insight */}
      {result.coachingInsight && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Coaching Insight
          </h3>
          <div className="bg-indigo-50 border border-indigo-200 rounded-md p-4">
            <p className="text-sm text-indigo-900">{result.coachingInsight}</p>
          </div>
        </div>
      )}

      {/* Regenerate */}
      <div className="flex justify-center pt-4 pb-8">
        <button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-md hover:bg-indigo-50 disabled:opacity-50 transition-colors"
        >
          {isRegenerating ? 'Regenerating...' : 'Regenerate Critique'}
        </button>
      </div>
    </div>
  )
}
