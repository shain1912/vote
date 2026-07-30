import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at startup rather than letting every query fail silently later.
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in ' +
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  )
}

// Single shared Supabase client for the whole app. Only the publishable/anon
// key is ever used here — it is safe to ship to the browser because access
// is enforced by Postgres Row Level Security policies on the server side.
//
// NEVER import a service_role key into this file or anywhere else in
// frontend code.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
