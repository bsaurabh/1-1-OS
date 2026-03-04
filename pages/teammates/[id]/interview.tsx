import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import type { NextPage, GetServerSidePropsContext } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import InterviewChat from '@/components/interview/InterviewChat'
import { withAuth, WithAuthProps } from '@/lib/withAuth'
import type { ConversationTurn, ProfileArea } from '@/handlers/interviewAIHandler'
import { ProfileArea as PA } from '@/handlers/interviewAIHandler'

interface InterviewPageProps extends WithAuthProps {
  managerEmail:  string
  teammateId:    string
  teammateName:  string
  role:          string
}

type InterviewState =
  | 'LOADING_FIRST_QUESTION'
  | 'AWAITING_ANSWER'
  | 'SUBMITTING_ANSWER'
  | 'SYNTHESIZING'
  | 'FALLBACK'

const InterviewPage: NextPage<InterviewPageProps> = ({
  managerEmail,
  teammateId,
  teammateName,
  role,
}) => {
  const router = useRouter()

  const [state, setState]               = useState<InterviewState>('LOADING_FIRST_QUESTION')
  const [turns, setTurns]               = useState<ConversationTurn[]>([])
  const [currentQuestion, setCurrentQ]  = useState('')
  const [currentArea, setCurrentArea]   = useState<ProfileArea>(PA.STRENGTHS)
  const [currentIndex, setCurrentIndex] = useState(1)
  const [currentAnswer, setAnswer]      = useState('')

  const fetchNextQuestion = useCallback(
    async (history: ConversationTurn[], latestAnswer: string) => {
      const res = await fetch(`/api/interviews/${teammateId}/next`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ conversationHistory: history, latestAnswer }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.fallback) return { fallback: true }
        throw new Error('Failed to fetch next question')
      }

      return res.json()
    },
    [teammateId],
  )

  const completeSynthesis = useCallback(
    async (history: ConversationTurn[]) => {
      setState('SYNTHESIZING')
      const res = await fetch(`/api/interviews/${teammateId}/complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ conversationHistory: history }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.fallback) {
          setState('FALLBACK')
          router.replace(`/teammates/${teammateId}?editMode=1`)
          return
        }
      }
      router.replace(`/teammates/${teammateId}`)
    },
    [teammateId, router],
  )

  // Load first question on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchNextQuestion([], '')
        if (cancelled) return
        if (data.fallback) {
          setState('FALLBACK')
          router.replace(`/teammates/${teammateId}?editMode=1`)
          return
        }
        setCurrentQ(data.question)
        setCurrentArea(data.area)
        setCurrentIndex(data.questionIndex)
        setState('AWAITING_ANSWER')
      } catch {
        if (!cancelled) {
          setState('FALLBACK')
          router.replace(`/teammates/${teammateId}?editMode=1`)
        }
      }
    })()
    return () => { cancelled = true }
  }, [fetchNextQuestion, teammateId, router])

  async function handleSubmit() {
    if (state !== 'AWAITING_ANSWER' || !currentAnswer.trim()) return

    setState('SUBMITTING_ANSWER')

    const newTurn: ConversationTurn = {
      questionIndex: currentIndex,
      area:          currentArea,
      question:      currentQuestion,
      answer:        currentAnswer.trim(),
    }
    const updatedTurns = [...turns, newTurn]
    setTurns(updatedTurns)
    setAnswer('')

    try {
      const data = await fetchNextQuestion(updatedTurns, currentAnswer.trim())

      if (data.fallback) {
        setState('FALLBACK')
        router.replace(`/teammates/${teammateId}?editMode=1`)
        return
      }

      if (data.isComplete) {
        await completeSynthesis(updatedTurns)
        return
      }

      setCurrentQ(data.question)
      setCurrentArea(data.area)
      setCurrentIndex(data.questionIndex)
      setState('AWAITING_ANSWER')
    } catch {
      setState('FALLBACK')
      router.replace(`/teammates/${teammateId}?editMode=1`)
    }
  }

  return (
    <AppLayout managerEmail={managerEmail}>
      <div className="max-w-2xl mx-auto py-8 px-4 h-full flex flex-col">
        <div className="mb-4">
          <button
            onClick={() => router.push(`/teammates/${teammateId}`)}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to profile
          </button>
        </div>

        {state === 'FALLBACK' && (
          <div
            data-testid="interview-fallback-message"
            className="p-4 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800"
          >
            AI interview unavailable. You can fill in the profile manually.
          </div>
        )}

        {state !== 'FALLBACK' && (
          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-6 min-h-0 flex flex-col">
            <InterviewChat
              teammateName={teammateName}
              turns={turns}
              currentQuestion={currentQuestion}
              currentQuestionIndex={currentIndex}
              currentArea={currentArea}
              currentAnswer={currentAnswer}
              isLoading={state === 'LOADING_FIRST_QUESTION' || state === 'SUBMITTING_ANSWER'}
              isComplete={false}
              isSynthesizing={state === 'SYNTHESIZING'}
              onAnswerChange={setAnswer}
              onSubmit={handleSubmit}
            />
          </div>
        )}
      </div>
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(InterviewPage, async (ctx: GetServerSidePropsContext, managerId: string) => {
  const { getTeammate } = await import('@/lib/teammates')
  const { prisma } = await import('@/lib/prisma')
  const id = ctx.params?.id as string

  const [teammate, manager] = await Promise.all([
    getTeammate(managerId, id),
    prisma.manager.findUnique({ where: { id: managerId }, select: { email: true } }),
  ])

  if (!teammate) return { notFound: true }

  return {
    props: {
      teammateId:   teammate.id,
      teammateName: teammate.name,
      role:         teammate.role,
      managerEmail: manager?.email ?? '',
    },
  }
})
export default _page
export const getServerSideProps = _getServerSideProps
