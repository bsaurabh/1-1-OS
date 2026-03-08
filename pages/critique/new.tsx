import { useState } from 'react'
import { useRouter } from 'next/router'
import type { NextPage } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import CritiqueForm from '@/components/critique/CritiqueForm'
import type { CritiqueFormData } from '@/components/critique/CritiqueForm'
import { withAuth, WithAuthProps } from '@/lib/withAuth'

interface NewCritiqueProps extends WithAuthProps {
  managerEmail: string
}

const NewCritiquePage: NextPage<NewCritiqueProps> = ({ managerEmail }) => {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(data: CritiqueFormData) {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json()
        setError(body.error || 'Failed to create critique')
        return
      }

      const { id } = await res.json()
      router.push(`/critique/${id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppLayout managerEmail={managerEmail}>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="mb-6">
          <button
            onClick={() => router.push('/critique')}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to critiques
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-xl font-semibold text-gray-900">New Design Critique</h1>
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
            Beta
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <CritiqueForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(NewCritiquePage, async (_ctx, managerId) => {
  const { prisma } = await import('@/lib/prisma')
  const manager = await prisma.manager.findUnique({
    where: { id: managerId },
    select: { email: true },
  })
  return { props: { managerEmail: manager?.email ?? '' } }
})
export default _page
export const getServerSideProps = _getServerSideProps
