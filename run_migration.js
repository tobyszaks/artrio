const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Your Supabase credentials
const supabaseUrl = 'https://nqwijkvpzyadpsegvgbm.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Need SUPABASE_SERVICE_KEY environment variable');
  console.log('\nTo get your service key:');
  console.log('1. Go to: https://supabase.com/dashboard/project/nqwijkvpzyadpsegvgbm/settings/api');
  console.log('2. Find "Service role key" (starts with eyJ...)');
  console.log('3. Copy it and run:');
  console.log('   export SUPABASE_SERVICE_KEY="your-service-key-here"');
  console.log('4. Then run this script again');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    // Read the migration file
    const migration = fs.readFileSync('/Users/tyler/rantrio/supabase/migrations/20250817000001_add_direct_messages.sql', 'utf8');
    
    console.log('🚀 Running DM migration...');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migration });
    
    if (error) {
      // Try direct approach
      console.log('Trying alternative method...');
      // Unfortunately, Supabase doesn't expose a direct SQL execution endpoint
      console.error('❌ Cannot run migrations via API - must use dashboard');
      console.log('\nPlease run the migration manually in the SQL Editor');
      return;
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

runMigration();