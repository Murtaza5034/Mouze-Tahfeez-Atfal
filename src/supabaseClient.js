import { createClient } from '@supabase/supabase-js'

const fallbackSupabaseUrl = 'https://medypnbcsjytbxiwenob.supabase.co'
const fallbackSupabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZHlwbmJjc2p5dGJ4aXdlbm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODkxNDYsImV4cCI6MjA5MjI2NTE0Nn0.uuZr6KQ0AB2jGxk40AcTdUYcMHT-sI4P6sMYV_0L_uQ'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey

// Supabase initialization with optional environment variables and built-in fallbacks.
// Disable Realtime auto-connect to prevent WebSocket errors on page load

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  // Disable auto-connect to realtime channels to prevent WebSocket errors
  // when auth is not yet established
  db: {
    schema: 'public',
  },
})
