import { ReactNode } from 'react'
import { useRouter } from 'next/router'
import SideNav from './SideNav'

interface AppLayoutProps {
  children: ReactNode
  managerEmail?: string
}

export default function AppLayout({ children, managerEmail }: AppLayoutProps) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200" data-testid="app-nav">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <span className="text-lg font-semibold text-indigo-600" data-testid="app-logo">
              Sidekick
            </span>
            <div className="flex items-center gap-4">
              {managerEmail && (
                <span className="text-sm text-gray-500" data-testid="manager-email">
                  {managerEmail}
                </span>
              )}
              <button
                onClick={handleLogout}
                data-testid="logout-button"
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <div className="flex">
        <SideNav />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8" data-testid="app-main">
          {children}
        </main>
      </div>
    </div>
  )
}
