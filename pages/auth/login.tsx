import { useState, FormEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import { verifySessionToken } from '@/lib/auth'
import AuthForm from '@/components/auth/AuthForm'
import PasswordInput from '@/components/auth/PasswordInput'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        router.push('/dashboard')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Login failed.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthForm
      title="Sign in to 1:1OS"
      onSubmit={handleSubmit}
      isLoading={isLoading}
      submitLabel="Sign in"
      error={error}
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
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

      <PasswordInput
        id="password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
        autoComplete="current-password"
      />

      <div className="text-right">
        <Link
          href="/auth/forgot-password"
          className="text-xs text-indigo-600 hover:underline"
          data-testid="forgot-password-link"
        >
          Forgot password?
        </Link>
      </div>

      <p className="text-center text-sm text-gray-500 mt-2">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-indigo-600 hover:underline" data-testid="register-link">
          Sign up
        </Link>
      </p>
    </AuthForm>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = ctx.req.cookies['session']
  if (token) {
    try {
      await verifySessionToken(token)
      return { redirect: { destination: '/dashboard', permanent: false } }
    } catch {
      // Token invalid — show login page
    }
  }
  return { props: {} }
}
