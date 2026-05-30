import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://medypnbcsjytbxiwenob.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return res.status(400).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY not set in environment',
      sql: `ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS background_url TEXT DEFAULT '';
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS school_heading_ar TEXT DEFAULT '';
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS school_heading_en TEXT DEFAULT '';
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS age TEXT DEFAULT '';
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS arabic_name TEXT DEFAULT '';
ALTER TABLE public.child_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;`,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const sql = `
      ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS background_url TEXT DEFAULT '';
      ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS school_heading_ar TEXT DEFAULT '';
      ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS school_heading_en TEXT DEFAULT '';
      ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS age TEXT DEFAULT '';
      ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS arabic_name TEXT DEFAULT '';
      ALTER TABLE public.child_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
    `;
    const { error } = await supabase.rpc('exec_sql', { query: sql });
    if (error && error.message?.includes('function "exec_sql" does not exist')) {
      const { error: rawError } = await supabase.from('_migrations').insert([{ sql, ran_at: new Date().toISOString() }]).select();
      if (rawError) {
        return res.status(500).json({
          error: 'exec_sql RPC not available and direct insert failed',
          details: rawError.message,
          sql,
        });
      }
    }
    if (error) throw error;
    return res.json({ success: true, message: 'All columns added successfully' });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
      sql: `ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS background_url TEXT DEFAULT '';
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS school_heading_ar TEXT DEFAULT '';
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS school_heading_en TEXT DEFAULT '';
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS age TEXT DEFAULT '';
ALTER TABLE marhala_posts ADD COLUMN IF NOT EXISTS arabic_name TEXT DEFAULT '';
ALTER TABLE public.child_profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;`,
    });
  }
}
