import { createClient } from '@supabase/supabase-js'

const fallbackSupabaseUrl = 'https://medypnbcsjytbxiwenob.supabase.co'
const fallbackSupabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZHlwbmJjc2p5dGJ4aXdlbm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODkxNDYsImV4cCI6MjA5MjI2NTE0Nn0.uuZr6KQ0AB2jGxk40AcTdUYcMHT-sI4P6sMYV_0L_uQ'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    'Supabase environment variables are missing. Falling back to built-in public project credentials.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
