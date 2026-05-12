// Simple script to verify system_notifications table structure
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://medypnbcsjytbxiwenob.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZHlwbmJjc2p5dGJ4aXdlbm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODkxNDYsImV4cCI6MjA5MjI2NTE0Nn0.uuZr6KQ0AB2jGxk40AcTdUYcMHT-sI4P6sMYV_0L_uQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTable() {
    console.log('🔍 Verifying system_notifications table structure...\n');
    
    try {
        // Check if table exists by trying to select from it
        const { data, error } = await supabase
            .from('system_notifications')
            .select('*')
            .limit(1);
            
        if (error) {
            console.error('❌ Error accessing system_notifications table:', error.message);
            console.log('\n📝 Possible solutions:');
            console.log('1. Run the migration: 20240509000001_fix_system_notifications.sql');
            console.log('2. Check if you have the correct Supabase credentials');
            console.log('3. Verify the table exists in your Supabase project');
            return;
        }
        
        console.log('✅ Table exists and is accessible');
        
        // Check table structure by inserting a test record
        const testRecord = {
            title: 'Test Notification',
            body: 'This is a test to verify table structure',
            target_role: 'all',
            redirect_page: 'Home'
        };
        
        const { data: insertData, error: insertError } = await supabase
            .from('system_notifications')
            .insert([testRecord])
            .select();
            
        if (insertError) {
            console.error('❌ Error inserting test record:', insertError.message);
            
            if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
                console.log('\n🔧 Column missing detected. The migration should fix this.');
            }
            return;
        }
        
        console.log('✅ Table structure is correct');
        console.log('📄 Test record inserted:', insertData[0]);
        
        // Clean up test record
        if (insertData && insertData[0]) {
            await supabase
                .from('system_notifications')
                .delete()
                .eq('id', insertData[0].id);
            console.log('🧹 Test record cleaned up');
        }
        
        console.log('\n🎉 Table verification completed successfully!');
        
    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
    }
}

verifyTable();
