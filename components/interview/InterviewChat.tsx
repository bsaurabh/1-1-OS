import { useEffect, useRef } from 'react'
import type { ConversationTurn, ProfileArea } from '@/handlers/interviewAIHandler'

const AREA_LABELS: Record<string, string> = {
  strengths:            'Strengths',
  growthAreas:          'Growth Areas',
  aspirations:          'Aspirations',
  kpis:                 'KPIs & Metrics',
  behavioralTendencies: 'Behavioral Tendencies',
  feedbackStyle:        'Feedback Style',
  motivationDrivers:    'Motivation Drivers',
}

interface InterviewChatProps {
  teammateName:        string
  turns:               ConversationTurn[]
  currentQuestion:     string
  currentQuestionIndex: number
  currentArea:         ProfileArea
  currentAnswer:       string
  isLoading:           boolean
  isComplete:          boolean
  isSynthesizing:      boolean
  onAnswerChange:      (value: string) => void
  onSubmit:            () => void
}

export default function InterviewChat({
  teammateName,
  turns,
  currentQuestion,
  currentQuestionIndex,
  currentArea,
  currentAnswer,
  isLoading,
  isComplete,
  isSynthesizing,
  onAnswerChange,
  onSubmit,
}: InterviewChatProps) {
  const answerRef     = useRef<HTMLTextAreaElement>(null)
  const bottomRef     = useRef<HTMLDivElement>(null)
  const TOTAL = 7

  useEffect(() => {
    if (!isLoading && answerRef.current) {
      answerRef.current.focus()
    }
  }, [isLoading, currentQuestionIndex])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, currentQuestion])

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!isLoading && currentAnswer.trim()) onSubmit()
    }
  }

  if (isSynthesizing) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4" />
        <p data-testid="synthesizing-message" className="text-sm">Building {teammateName}&apos;s profile…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <p className="text-sm text-gray-500">
          Building <span className="font-medium text-gray-700">{teammateName}</span>&apos;s profile
        </p>
        {/* Progress bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex - 1) / TOTAL) * 100}%` }}
            />
          </div>
          <span
            data-testid="interview-progress"
            className="text-xs text-gray-400 whitespace-nowrap"
          >
            Question {currentQuestionIndex} of {TOTAL}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Topic: {AREA_LABELS[currentArea] ?? currentArea}
        </p>
      </div>

      {/* Conversation history */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
        {turns.map((turn, i) => (
          <div key={i} className="space-y-2">
            {/* AI question bubble */}
            <div className="flex gap-2">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                AI
              </div>
              <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 max-w-prose">
                {turn.question}
              </div>
            </div>
            {/* Manager answer bubble */}
            <div className="flex gap-2 justify-end">
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm text-gray-700 max-w-prose">
                {turn.answer || <span className="text-gray-400 italic">(no answer)</span>}
              </div>
            </div>
          </div>
        ))}

        {/* Current question */}
        {currentQuestion && !isComplete && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              AI
            </div>
            <div
              data-testid="interview-question"
              className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 max-w-prose"
            >
              {isLoading ? (
                <span className="text-gray-400 animate-pulse">Thinking…</span>
              ) : (
                currentQuestion
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Answer input */}
      {!isComplete && (
        <div className="border-t border-gray-200 pt-4">
          <textarea
            ref={answerRef}
            data-testid="interview-answer-input"
            value={currentAnswer}
            onChange={e => onAnswerChange(e.target.value)}
            onKeyDown={handleKey}
            disabled={isLoading}
            rows={3}
            maxLength={1000}
            placeholder="Type your answer… (Cmd+Enter to submit)"
            aria-label="Your answer"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">{currentAnswer.length}/1000</span>
            <button
              data-testid="submit-answer-button"
              onClick={onSubmit}
              disabled={isLoading || !currentAnswer.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full" />
                  Thinking…
                </span>
              ) : (
                'Submit Answer'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
