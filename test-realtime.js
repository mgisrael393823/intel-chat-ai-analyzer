const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://npsqlaumhzzlqjtycpim.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wc3FsYXVtaHp6bHFqdHljcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDAzMzAsImV4cCI6MjA2ODI3NjMzMH0.i_dRSQj_l5bpzHjKMeq58QjWwoa8Y2QikeZrav8-rxo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRealtime() {
  console.log('Setting up realtime subscription...');
  
  // Subscribe to changes
  const subscription = supabase
    .channel('document-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'documents',
    }, (payload) => {
      console.log('📡 Realtime event received:', payload);
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
    });

  console.log('Subscription created. Waiting for events...');
  console.log('Update a document in another terminal to test.');
  
  // Keep process alive
  process.stdin.resume();
}

testRealtime();