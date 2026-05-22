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

async function resetPassword() {
  const email = 'mkj_52@hotmail.com';
  console.log('Finding user record for', email);
  
  const { data: accessData, error: accessError } = await supabase
    .from('user_portal_access')
    .select('*')
    .eq('email', email)
    .single();

  if (accessError || !accessData) {
    console.error('Error finding user:', accessError);
    return;
  }

  const userId = accessData.user_id;
  console.log('Found user_id:', userId);

  console.log('Updating password for user_id:', userId);
  const { data, error } = await supabase.auth.admin.updateUserById(
    userId,
    { password: 'password123' }
  );

  if (error) {
    console.error('Error resetting password:', error);
  } else {
    console.log('Successfully updated password for', email);
  }
}

resetPassword();
