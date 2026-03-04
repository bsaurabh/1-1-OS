import { useState } from 'react'
import { useRouter } from 'next/router'
import type { NextPage } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import TeammateList from '@/components/teammates/TeammateList'
import AddTeammateModal from '@/components/teammates/AddTeammateModal'
import { withAuth, WithAuthProps } from '@/lib/withAuth'
import type { TeammateListItem } from '@/lib/teammates'

interface DashboardProps extends WithAuthProps {
  managerEmail: string
  teammates:    TeammateListItem[]
}

const DashboardPage: NextPage<DashboardProps> = ({ managerEmail, teammates: initial }) => {
  const router = useRouter()
  const [isModalOpen, setModalOpen] = useState(false)

  function handleAddSuccess(teammateId: string) {
    setModalOpen(false)
    router.push(`/teammates/${teammateId}/interview`)
  }

  return (
    <AppLayout managerEmail={managerEmail}>
      <div className="max-w-2xl mx-auto py-8 px-4">
        <TeammateList teammates={initial} onAddClick={() => setModalOpen(true)} />
      </div>

      <AddTeammateModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </AppLayout>
  )
}

const [_page, _getServerSideProps] = withAuth(DashboardPage, async (_ctx, managerId) => {
  const { prisma } = await import('@/lib/prisma')
  const { listTeammates } = await import('@/lib/teammates')

  const manager = await prisma.manager.findUnique({
    where: { id: managerId },
    select: { email: true },
  })
  const teammates = await listTeammates(managerId)

  return { props: { managerEmail: manager?.email ?? '', teammates } }
})
export default _page
export const getServerSideProps = _getServerSideProps
