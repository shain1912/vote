import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { loadAdminPassphrase } from '../lib/adminAuth'

interface AdminRouteGuardProps {
  children: ReactNode
}

/**
 * Wraps admin-only routes (e.g. /admin/dashboard). Redirects to
 * /admin/login when there's no cached admin passphrase in sessionStorage,
 * so the results page can never be reached via a guessable URL alone.
 *
 * This is only a UX gate, not the real enforcement — sessionStorage is
 * trivially spoofable. The actual check happens server-side: every
 * passphrase-gated RPC re-verifies it and raises a "forbidden" error if
 * it's missing or wrong, which callers handle by clearing the cache and
 * bouncing back here.
 */
export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  if (!loadAdminPassphrase()) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}
