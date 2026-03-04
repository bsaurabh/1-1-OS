import { useState, FormEvent } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import AuthForm from '@/components/auth/AuthForm'
import PasswordInput from '@/components/auth/PasswordInput'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { token } = router.query

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  if (!token || typeof token !== 'string') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-sm text-red-600" data-testid="invalid-token-message">
            Invalid reset link.
          </p>
          <Link href="/auth/forgot-password" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
            Request a new one
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-sm text-gray-700 mb-4" data-testid="reset-success-message">
            Password updated. Please log in.
          </p>
          <Link href="/auth/login" className="text-sm text-indigo-600 hover:underline" data-testid="login-link">
            Go to login
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Password reset failed.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthForm
      title="Set a new password"
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitLabel="Update password"
      error={error}
    >
      <PasswordInput
        id="new-password"
        label="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
        autoComplete="new-password"
        hint="At least 8 characters"
      />
    </AuthForm>
  )
}
