#!/usr/bin/env tsx

// Test PDF extraction function directly
// Usage: npx tsx test-pdf-extraction.ts [document-id]

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://npsqlaumhzzlqjtycpim.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wc3FsYXVtaHp6bHFqdHljcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDAzMzAsImV4cCI6MjA2ODI3NjMzMH0.i_dRSQj_l5bpzHjKMeq58QjWwoa8Y2QikeZrav8-rxo";

async function testPdfExtraction(documentId?: string) {
  console.log('🧪 Testing PDF extraction...\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // 1. Check authentication
  console.log('1. Testing authentication...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('❌ Not authenticated. Please sign in through the app first.');
    return;
  }
  
  console.log('✅ Authenticated as:', user.email);
  
  // 2. Get document ID
  let targetDocumentId = documentId;
  
  if (!targetDocumentId) {
    console.log('\n2. Finding most recent document...');
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (docsError || !documents || documents.length === 0) {
      console.error('❌ No documents found');
      return;
    }
    
    console.log('Recent documents:');
    documents.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.name} (${doc.status}) - ${doc.id}`);
    });
    
    targetDocumentId = documents[0].id;
    console.log(`\n🎯 Using most recent document: ${documents[0].name}`);
  }
  
  // 3. Test extraction
  console.log('\n3. Testing PDF extraction...');
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('❌ No session found');
    return;
  }
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/extract-pdf-text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: targetDocumentId,
      }),
    });
    
    const duration = Date.now() - startTime;
    console.log(`Response time: ${duration}ms`);
    console.log('Status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Extraction failed:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Extraction result:', result);
    
    // 4. Verify document was updated
    console.log('\n4. Verifying document status...');
    const { data: updatedDoc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', targetDocumentId)
      .single();
    
    if (docError) {
      console.error('❌ Failed to fetch updated document:', docError);
      return;
    }
    
    console.log('Document status:', updatedDoc.status);
    console.log('Extracted text length:', updatedDoc.extracted_text?.length || 0);
    console.log('First 200 chars:', updatedDoc.extracted_text?.substring(0, 200) || 'No text');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Get document ID from command line args
const documentId = process.argv[2];
testPdfExtraction(documentId).catch(console.error);