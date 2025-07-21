import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://npsqlaumhzzlqjtycpim.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.log('You can find it in your Supabase dashboard under Settings > API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testDocumentLifecycle() {
  console.log('🧪 Testing document lifecycle...');

  // Create a test document (bypassing RLS with service key)
  const testDoc = {
    user_id: '00000000-0000-0000-0000-000000000000', // Test user ID
    name: 'test-document.pdf',
    size: 1024,
    type: 'application/pdf',
    storage_url: 'https://example.com/test.pdf',
    status: 'processing'
  };

  console.log('📝 Creating test document...');
  const { data: createdDoc, error: createError } = await supabase
    .from('documents')
    .insert(testDoc)
    .select()
    .single();

  if (createError) {
    console.error('Create error:', createError);
    return;
  }

  console.log('✅ Document created:', { id: createdDoc.id, status: createdDoc.status });
  console.log('⏳ Waiting 2 seconds...');
  
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Update the document status
  console.log('🔄 Updating document status to "ready"...');
  const { error: updateError } = await supabase
    .from('documents')
    .update({ status: 'ready', extracted_text: 'Test content extracted' })
    .eq('id', createdDoc.id);

  if (updateError) {
    console.error('Update error:', updateError);
  } else {
    console.log('✅ Document updated! Check the realtime subscription terminal.');
  }

  // Clean up
  console.log('🧹 Cleaning up test document...');
  await supabase
    .from('documents')
    .delete()
    .eq('id', createdDoc.id);

  process.exit(0);
}

testDocumentLifecycle();