// Test script to verify PDF extraction
const { createClient } = require('@supabase/supabase-js');

// Replace with your Supabase URL and anon key
const supabaseUrl = 'https://npsqlaumhzzlqjtycpim.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wc3FsYXVtaHp6bHFqdHljcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDAzMzAsImV4cCI6MjA2ODI3NjMzMH0.i_dRSQj_l5bpzHjKMeq58QjWwoa8Y2QikeZrav8-rxo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testExtraction(documentId) {
  console.log('Testing PDF extraction for document:', documentId);
  
  try {
    // Get auth token from localStorage or session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('No auth session found. Please login first.');
      return;
    }
    
    // Call the extraction function directly
    const response = await fetch(`${supabaseUrl}/functions/v1/extract-pdf-text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentId }),
    });
    
    console.log('Response status:', response.status);
    
    const result = await response.json();
    console.log('Response:', result);
    
    // Check document status
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();
      
    console.log('Document status after extraction:', document?.status);
    console.log('Document error message:', document?.error_message);
    console.log('Extracted text length:', document?.extracted_text?.length || 0);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run with: node test-pdf-extraction.js <document-id>
const documentId = process.argv[2];
if (!documentId) {
  console.error('Please provide a document ID as argument');
  process.exit(1);
}

testExtraction(documentId);