import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const line = envContent.split('\n').find(l => l.startsWith(name + '='));
  if (line) {
    return line.split('=')[1].replace(/['"]/g, '').trim();
  }
  return null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('Testing "jadawal" table query...');
  const { data: jadawalData, error: jadawalErr } = await supabase.from('jadawal').select('*').limit(1);
  if (jadawalErr) {
    console.log('jadawal table query failed:', jadawalErr.message);
  } else {
    console.log('jadawal table exists! Found rows:', jadawalData.length);
  }

  console.log('Testing "jadwal" table query...');
  const { data: jadwalData, error: jadwalErr } = await supabase.from('jadwal').select('*').limit(1);
  if (jadwalErr) {
    console.log('jadwal table query failed:', jadwalErr.message);
  } else {
    console.log('jadwal table exists! Found rows:', jadwalData.length);
  }
}

checkTables();
