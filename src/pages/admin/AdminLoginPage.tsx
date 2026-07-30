import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BrandHeader } from '../../components/BrandHeader'
import { getErrorMessage, verifyAdminPassphrase } from '../../lib/api'
import { loadAdminPassphrase, storeAdminPassphrase } from '../../lib/adminAuth'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [cachedPassphrase] = useState(() => loadAdminPassphrase())
  const [passphraseInput, setPassphraseInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (cachedPassphrase) {
    return <Navigate to="/admin/dashboard" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const ok = await verifyAdminPassphrase(passphraseInput)
      if (!ok) {
        setError('암호가 올바르지 않습니다.')
        return
      }
      storeAdminPassphrase(passphraseInput)
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <BrandHeader />
      <div className="centered-stage">
        <div className="entry-card">
          <h1>관리자 로그인</h1>
          <p className="hint-text">결과 대시보드는 관리자만 볼 수 있습니다.</p>

          <form onSubmit={handleSubmit} className="stacked-form">
            <label htmlFor="admin-passphrase">암호</label>
            <input
              id="admin-passphrase"
              type="password"
              autoComplete="current-password"
              value={passphraseInput}
              onChange={(event) => {
                setPassphraseInput(event.target.value)
                setError(null)
              }}
              required
            />

            {error && <p className="error-text">{error}</p>}

            <button type="submit" disabled={submitting}>
              {submitting ? '확인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
