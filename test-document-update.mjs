import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://npsqlaumhzzlqjtycpim.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wc3FsYXVtaHp6bHFqdHljcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDAzMzAsImV4cCI6MjA2ODI3NjMzMH0.i_dRSQj_l5bpzHjKMeq58QjWwoa8Y2QikeZrav8-rxo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDocumentUpdate() {
  // First, sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'm+1@learsi.co',
    password: 'testpass123' // You'll need to replace with actual password
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  console.log('✅ Signed in as:', authData.user.email);

  // Check existing documents
  const { data: documents, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (fetchError) {
    console.error('Fetch error:', fetchError);
    return;
  }

  if (documents && documents.length > 0) {
    const doc = documents[0];
    console.log('📄 Found document:', { id: doc.id, name: doc.name, status: doc.status });
    
    // Update the document status
    console.log('🔄 Updating document status to "ready"...');
    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'ready' })
      .eq('id', doc.id);

    if (updateError) {
      console.error('Update error:', updateError);
    } else {
      console.log('✅ Document updated! Check the realtime subscription terminal.');
    }
  } else {
    console.log('❌ No documents found. Upload a PDF first.');
  }

  process.exit(0);
}

testDocumentUpdate();