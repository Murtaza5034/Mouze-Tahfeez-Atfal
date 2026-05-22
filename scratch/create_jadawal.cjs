import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function createJadawalTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.jadawal (
        student_id TEXT PRIMARY KEY,
        schedule_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE public.jadawal ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.jadawal;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.jadawal;
    DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.jadawal;

    -- Create policies
    CREATE POLICY "Enable read access for all users" ON public.jadawal FOR SELECT USING (true);
    CREATE POLICY "Enable insert for authenticated users only" ON public.jadawal FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    CREATE POLICY "Enable update for authenticated users only" ON public.jadawal FOR UPDATE USING (auth.role() = 'authenticated');
  `;

  // To execute raw SQL, we can use a supabase RPC or just use the REST API.
  // Wait, Supabase JS doesn't support raw SQL execution directly from the client without an RPC.
  // Let's create an RPC or just use postgres connection if we have it.
  // Actually, wait! The user's system has 'supabase' CLI? No.
  // Let's check if there's a way to run SQL. We have done this in other tasks by calling an existing RPC like `exec_sql` or similar, or by inserting via standard API if the table already exists.
  // Wait, does the table exist? Let's check.
  console.log("We need to execute SQL. Let's see if we can do it via a quick node-postgres script or if there is an existing RPC.");
}

createJadawalTable();
