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

async function test() {
  const { data: students, error: studentError } = await supabase.from('child_profiles').select('*').limit(20);
  console.log('Students count:', studentError ? studentError.message : students.length);
  if (students && students.length > 0) {
    students.forEach(s => {
      console.log(`Student ID: ${s.student_id} | Name: ${s.full_name} | Teacher: ${s.teacher_name}`);
    });
  }

  const { data: access, error: accessError } = await supabase.from('user_portal_access').select('*').limit(20);
  console.log('Access count:', accessError ? accessError.message : access.length);
  if (access && access.length > 0) {
    access.forEach(a => {
      console.log(`Email: ${a.email} | Role: ${a.portal_role} | Name: ${a.full_name}`);
    });
  }
}

test();
