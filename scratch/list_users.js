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

async function listUsers() {
  console.log('Querying user_portal_access...');
  const { data, error } = await supabase
    .from('user_portal_access')
    .select('*');

  if (error) {
    console.error('Error fetching portal access:', error);
  } else {
    console.log('Portal access records:');
    data.forEach(r => {
      console.log(`- Email: ${r.email}, Role: ${r.portal_role}, Active: ${r.is_active}`);
    });
  }
}

listUsers();
