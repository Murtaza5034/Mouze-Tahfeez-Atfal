
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://medypnbcsjytbxiwenob.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZHlwbmJjc2p5dGJ4aXdlbm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODkxNDYsImV4cCI6MjA5MjI2NTE0Nn0.uuZr6KQ0AB2jGxk40AcTdUYcMHT-sI4P6sMYV_0L_uQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTeachers() {
  const { data, error } = await supabase
    .from('teacher_profiles')
    .select('*')
    .order('full_name');

  if (error) {
    console.error('Error fetching teachers:', error);
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

listTeachers();
