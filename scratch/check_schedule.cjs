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

async function checkSchedule() {
  const { data, error } = await supabase
    .from('schedule')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching schedule:', error);
  } else {
    console.log('Schedule table exists! Sample data or columns:');
    if (data.length > 0) {
      console.log(Object.keys(data[0]));
    } else {
      console.log('Table is empty, trying to fetch an impossible id to get headers...');
      const { data: cols, error: colsErr } = await supabase.from('schedule').select('*').eq('id', 'impossible-id');
      console.log(colsErr || 'Success, but no way to know columns if empty via REST unless we use OpenAPI');
    }
  }
}

checkSchedule();
