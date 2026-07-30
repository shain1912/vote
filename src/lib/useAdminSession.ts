import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AdminSessionState {
  session: Session | null
  loading: boolean
}

/**
 * Tracks the current Supabase Auth session for the admin area.
 *
 * Only the admin logs in via Supabase Auth (email + password). Teams and
 * judges never authenticate this way, so this hook is only ever used inside
 * `/admin/*` routes.
 */
export function useAdminSession(): AdminSessionState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}
