import { FormEvent, ReactNode } from 'react'

interface AuthFormProps {
  title: string
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  submitLabel: string
  error?: string
  children: ReactNode
}

export default function AuthForm({
  title,
  onSubmit,
  isLoading,
  submitLabel,
  error,
  children,
}: AuthFormProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6 text-center">{title}</h1>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <form onSubmit={onSubmit} noValidate data-testid="auth-form">
            <div className="space-y-4">
              {children}
            </div>

            {error && (
              <div
                role="alert"
                data-testid="auth-form-error"
                className="mt-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              data-testid="auth-form-submit"
              className="mt-6 w-full flex justify-center items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {submitLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
