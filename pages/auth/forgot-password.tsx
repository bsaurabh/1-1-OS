import { useState, FormEvent, ChangeEvent } from 'react'
import Link from 'next/link'
import AuthForm from '@/components/auth/AuthForm'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Silent — always show success UI
    } finally {
      setIsLoading(false)
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <p className="text-sm text-gray-700 mb-4" data-testid="forgot-password-success">
              If an account exists for this email, a reset link has been sent.
            </p>
            <Link
              href="/auth/login"
              className="text-sm text-indigo-600 hover:underline"
              data-testid="back-to-login-link"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AuthForm
      title="Reset your password"
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitLabel="Send reset link"
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          disabled={isLoading}
          autoComplete="email"
          data-testid="email-input"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
        />
      </div>

      <div className="text-center mt-2">
        <Link
          href="/auth/login"
          className="text-sm text-indigo-600 hover:underline"
          data-testid="back-to-login-link"
        >
          Back to login
        </Link>
      </div>
    </AuthForm>
  )
}
