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

async function resetPassword() {
  const email = 'taher.rawat@mahadalzahra.com';
  const newPassword = 'password123';

  // 1. Get the user list to find the ID
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    return;
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    console.log(`User ${email} not found in auth. Attempting to create user...`);
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: newPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Mulla Taher Bhai Rawat', portal_role: 'admin' }
    });
    if (createError) {
      console.error('Error creating user:', createError);
    } else {
      console.log('Successfully created user in Auth!', createData.user.id);
    }
  } else {
    console.log(`Found user ${email} with ID: ${user.id}. Resetting password...`);
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );
    if (updateError) {
      console.error('Error updating user password:', updateError);
    } else {
      console.log('Successfully updated password to "password123"!');
    }
  }
}

resetPassword();
