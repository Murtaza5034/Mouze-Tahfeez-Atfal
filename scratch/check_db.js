import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envLocalPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envLocalPath, 'utf8');
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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const TABLES = [
  'child_profiles',
  'weekly_results',
  'events',
  'schedule',
  'user_portal_access',
  'custom_groups',
  'teacher_attendance',
  'teacher_profiles',
  'report_settings',
  'portal_issues'
];

async function checkCounts() {
  for (const table of TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ Table: ${table} - Error: ${error.message}`);
    } else {
      console.log(`✅ Table: ${table} - Count: ${count}`);
    }
  }
}

checkCounts();
