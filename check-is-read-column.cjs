// Check if is_read column exists in system_notifications table
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://medypnbcsjytbxiwenob.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZHlwbmJjc2p5dGJ4aXdlbm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODkxNDYsImV4cCI6MjA5MjI2NTE0Nn0.uuZr6KQ0AB2jGxk40AcTdUYcMHT-sI4P6sMYV_0L_uQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIsReadColumn() {
    console.log('🔍 Checking if is_read column exists...\n');
    
    try {
        // Try to select only the is_read column
        const { data, error } = await supabase
            .from('system_notifications')
            .select('is_read')
            .limit(1);
            
        if (error) {
            if (error.message.includes('column') && error.message.includes('is_read')) {
                console.log('❌ is_read column does NOT exist');
                console.log('📝 Need to run the migration to add the column');
                return false;
            } else if (error.message.includes('row-level security')) {
                console.log('✅ is_read column EXISTS (RLS policy blocking access)');
                console.log('📝 The column exists but is protected by RLS');
                return true;
            } else {
                console.error('❌ Unexpected error:', error.message);
                return false;
            }
        }
        
        console.log('✅ is_read column EXISTS and is accessible');
        return true;
        
    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
        return false;
    }
}

checkIsReadColumn();
