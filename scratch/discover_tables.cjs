
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://medypnbcsjytbxiwenob.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZHlwbmJjc2p5dGJ4aXdlbm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODkxNDYsImV4cCI6MjA5MjI2NTE0Nn0.uuZr6KQ0AB2jGxk40AcTdUYcMHT-sI4P6sMYV_0L_uQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  // Querying the pg_catalog via RPC if available, or just trying common names
  const { data, error } = await supabase.rpc('get_tables'); // unlikely to exist
  
  if (error) {
    console.log('RPC failed, trying common tables...');
    const tables = ['students', 'student', 'teacher_profiles', 'teacher_profile', 'user_portal_access', 'weekly_results', 'system_notifications', 'events', 'custom_groups'];
    for (const table of tables) {
      const { error: tableError } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (!tableError) {
        console.log(`Table exists: ${table}`);
      } else {
        console.log(`Table error (${table}): ${tableError.message}`);
      }
    }
  } else {
    console.log(data);
  }
}

listTables();
