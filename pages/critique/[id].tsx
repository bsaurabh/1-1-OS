import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import type { NextPage, GetServerSidePropsContext } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import CritiqueResultView from '@/components/critique/CritiqueResultView'
import { withAuth, WithAuthProps } from '@/lib/withAuth'

interface CritiqueDetailProps extends WithAuthProps {
  managerEmail: string
  critiqueId: string
  featureName: string
  initialStatus: string
  imageCount: number
  imageUrls: string[]
}

const ANALYSIS_STEPS = [
  'Reading design screenshots…',
  'Evaluating information hierarchy…',
  'Running usability heuristics…',
  'Checking visual craft & consistency…',
  'Assessing accessibility signals…',
  'Analyzing product thinking…',
  'Identifying missed opportunities…',
  'Generating designer questions…',
  'Compiling structured critique…',
]

const CritiqueDetailPage: NextPage<CritiqueDetailProps> = ({
  managerEmail,
  critiqueId,
  featureName,
  initialStatus,
  imageCount,
  imageUrls,
}) => {
  const router = useRouter()
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [status, setStatus] = useState(initialStatus)
  const [error, setError] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Kick off analysis
  const startAnalysis = useCallback(async () => {
    setError(null)
    setStatus('ANALYZING')
    setStepIndex(0)

    try {
      await fetch(`/api/critique/${critiqueId}/generate`, { method: 'POST' })
    } catch {
      // poll will catch the real status
    }
  }, [critiqueId])

  // Poll for completion
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/critique/${critiqueId}`)
      const data = await res.json()
      const critique = data.critique

      if (critique?.status === 'COMPLETE' && critique.result) {
        setResult(critique.result)
        setStatus('COMPLETE')
        if (pollRef.current) clearInterval(pollRef.current)
        if (stepRef.current) clearInterval(stepRef.current)
      } else if (critique?.status === 'FAILED') {
        setStatus('FAILED')
        setError('Analysis failed. The AI could not process these images. Try different screenshots or retry.')
        if (pollRef.current) clearInterval(pollRef.current)
        if (stepRef.current) clearInterval(stepRef.current)
      }
    } catch {
      // silently retry on next poll
    }
  }, [critiqueId])

  useEffect(() => {
    if (initialStatus === 'COMPLETE') {
      // Load existing result
      fetch(`/api/critique/${critiqueId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.critique?.result) {
            setResult(data.critique.result)
            setStatus('COMPLETE')
          } else {
            startAnalysis()
          }
        })
        .catch(() => startAnalysis())
    } else if (initialStatus === 'ANALYZING') {
      // Already in progress, just poll
      setStatus('ANALYZING')
    } else {
      startAnalysis()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Start polling and step animation when analyzing
  useEffect(() => {
    if (status === 'ANALYZING') {
      pollRef.current = setInterval(pollStatus, 3000)
      stepRef.current = setInterval(() => {
        setStepIndex((prev) => (prev + 1) % ANALYSIS_STEPS.length)
      }, 4000)

      return () => {
        if (pollRef.current) clearInterval(pollRef.current)
        if (stepRef.current) clearInterval(stepRef.current)
      }
    }
  }, [status, pollStatus])

  function handleRetry() {
    startAnalysis()
  }

  function handleRegenerate() {
    setResult(null)
    // Reset status in DB
    fetch(`/api/critique/${critiqueId}/generate`, { method: 'POST' })
      .then(() => {
        setStatus('ANALYZING')
        setStepIndex(0)
      })
      .catch(() => setError('Failed to start regeneration.'))
  }

  return (
    <AppLayout managerEmail={managerEmail}>
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="mb-6">
          <button
            onClick={() => router.push('/critique')}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to critiques
          </button>
        </div>

        {/* Analyzing state */}
        {status === 'ANALYZING' && (
          <div className="text-center py-20">
            {/* Animated rings */}
            <div className="relative inline-flex items-center justify-center w-16 h-16 mb-6">
              <div className="absolute w-16 h-16 border-4 border-indigo-200 rounded-full" />
              <div className="absolute w-16 h-16 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin" />
              <div className="absolute w-10 h-10 border-4 border-transparent border-t-indigo-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Analyzing: {featureName}
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              {imageCount} screenshot{imageCount !== 1 ? 's' : ''} &middot; This typically takes 30-60 seconds
            </p>

            {/* Animated step indicator */}
            <div className="mt-6 inline-block">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                <p className="text-sm text-gray-600 transition-all duration-300">
                  {ANALYSIS_STEPS[stepIndex]}
                </p>
              </div>
            </div>

            {/* Navigation hint */}
            <p className="text-xs text-gray-400 mt-8">
              You can navigate away — the analysis will continue in the background.
              <br />
              Come back to this page anytime to see the results.
            </p>
            <button
              onClick={() => router.push('/critique')}
              className="mt-3 text-xs text-indigo-600 hover:underline"
            >
              Go to critique list →
            </button>
          </div>
        )}

        {/* Error state */}
        {status === 'FAILED' && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-red-50 rounded-full mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Analysis Failed</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
              {error || 'Something went wrong while analyzing the design. This could be due to image format issues or a temporary service error.'}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Retry Analysis
              </button>
              <button
                onClick={() => router.push('/critique')}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Back to List
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {status === 'COMPLETE' && result != null && (
          <CritiqueResultView
            result={result as never}
            featureName={featureName}
            imageUrls={imageUrls}
            onRegenerate={handleRegenerate}
            isRegenerating={false}
          />
        )}
      </div>
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(
  CritiqueDetailPage,
  async (ctx: GetServerSidePropsContext, managerId: string) => {
    const { prisma } = await import('@/lib/prisma')

    const id = ctx.params?.id as string

    const [critique, manager] = await Promise.all([
      prisma.designCritique.findFirst({
        where: { id, managerId },
        select: { featureName: true, status: true, imageUrls: true },
      }),
      prisma.manager.findUnique({ where: { id: managerId }, select: { email: true } }),
    ])

    if (!critique) return { notFound: true }

    return {
      props: {
        critiqueId: id,
        featureName: critique.featureName,
        initialStatus: critique.status,
        imageCount: critique.imageUrls.length,
        imageUrls: critique.imageUrls,
        managerEmail: manager?.email ?? '',
      },
    }
  }
)
export default _page
export const getServerSideProps = _getServerSideProps
