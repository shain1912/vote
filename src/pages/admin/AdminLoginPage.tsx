import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAdminSession } from '../../lib/useAdminSession'

export function AdminLoginPage() {
  const { session, loading } = useAdminSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to="/admin/dashboard" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setSubmitting(false)

    if (signInError) {
      setError(signInError.message)
    }
    // On success, useAdminSession picks up the new session via
    // onAuthStateChange and this component re-renders into the redirect
    // above.
  }

  return (
    <div className="page page--narrow">
      <h1>관리자 로그인</h1>
      <p className="page-subtitle">결과 대시보드는 관리자만 볼 수 있습니다.</p>

      <form onSubmit={handleSubmit} className="stacked-form">
        <label htmlFor="admin-email">이메일</label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="admin-password">비밀번호</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  )
}
