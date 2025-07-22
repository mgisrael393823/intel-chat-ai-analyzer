import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://npsqlaumhzzlqjtycpim.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wc3FsYXVtaHp6bHFqdHljcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDAzMzAsImV4cCI6MjA2ODI3NjMzMH0.i_dRSQj_l5bpzHjKMeq58QjWwoa8Y2QikeZrav8-rxo'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Create minimal PDF content for testing
function createTestPDF() {
  const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT/Helvetica 12 Tf 72 720 Td(Test PDF Content)Tj ET
endstream endobj
xref 0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000251 00000 n 
trailer<</Size 5/Root 1 0 R>>startxref 320%%EOF`;
  return pdfContent;
}

async function run() {
  console.log('🧪 Running integration test...')
  
  try {
    // Step 1: Test health check (no auth required)
    console.log('📍 Testing health check...')
    const healthRes = await supabase.functions.invoke('extract-pdf-text', {
      body: { documentId: 'health-check' }
    })
    console.log('Health check:', healthRes.error ? `❌ ${healthRes.error.message}` : '✅ OK')
    
    // Step 2: Test anonymous user signup (for realistic test)
    console.log('📍 Creating test user...')
    const email = `test-${Date.now()}@example.com`
    const password = 'testpassword123'
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    })
    
    if (signUpError && !signUpError.message.includes('already registered')) {
      throw new Error(`Signup failed: ${signUpError.message}`)
    }
    
    // Try to sign in (works whether user was just created or already exists)
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({ 
      email, 
      password 
    })
    
    if (signInError || !session) {
      throw new Error(`Auth failed: ${signInError?.message || 'No session'}`)
    }
    console.log('Auth:', '✅ OK')
    
    // Step 3: Test file upload with proper document creation
    console.log('📍 Testing file upload...')
    const testPdfContent = createTestPDF()
    const testFile = new Blob([testPdfContent], { type: 'application/pdf' })
    
    // Upload to storage with user-prefixed path
    const userId = session.user.id
    const fileName = `${userId}/${Date.now()}.pdf`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, testFile)
    
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
    console.log('Upload:', '✅ OK')
    
    // Step 4: Create document record in database
    console.log('📍 Creating document record...')
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        name: 'test.pdf',
        size: testPdfContent.length,
        type: 'application/pdf',
        storage_url: supabase.storage.from('documents').getPublicUrl(fileName).data.publicUrl,
        status: 'processing'
      })
      .select()
      .single()
    
    if (docError) throw new Error(`Document creation failed: ${docError.message}`)
    console.log('Document record:', '✅ OK')
    
    // Step 5: Test PDF extraction
    console.log('📍 Testing PDF extraction...')
    const extractRes = await supabase.functions.invoke('extract-pdf-text', {
      body: { documentId: docData.id },
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    
    if (extractRes.error) {
      console.log('PDF extraction:', `❌ ${extractRes.error.message}`)
    } else {
      console.log('PDF extraction:', '✅ OK')
    }
    
    // Step 6: Test chat functionality
    console.log('📍 Testing chat...')
    const chatRes = await supabase.functions.invoke('chat-stream', {
      body: { 
        message: 'Hello, can you analyze this document?',
        documentId: docData.id 
      },
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
    
    if (chatRes.error) {
      console.log('Chat:', `❌ ${chatRes.error.message}`)
    } else {
      console.log('Chat:', '✅ OK')
    }
    
    // Cleanup
    console.log('📍 Cleaning up...')
    await supabase.from('documents').delete().eq('id', docData.id)
    await supabase.storage.from('documents').remove([fileName])
    
    console.log('🎉 Integration test completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

run().catch(err => { 
  console.error('💥 Unexpected error:', err)
  process.exit(1) 
})