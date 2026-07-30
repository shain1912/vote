import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAdminSession } from '../lib/useAdminSession'

interface AdminRouteGuardProps {
  children: ReactNode
}

/**
 * Wraps admin-only routes (e.g. /admin/dashboard). Redirects to
 * /admin/login when there is no authenticated Supabase session, so the
 * results page can never be reached via a guessable URL alone.
 */
export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { session, loading } = useAdminSession()

  if (loading) {
    return <p className="page-status">Loading session...</p>
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}
