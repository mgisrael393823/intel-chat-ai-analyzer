#!/usr/bin/env tsx

// Quick debug script for streaming issues
// Usage: npx tsx debug-stream.ts

async function debugStreamIssue() {
  console.log('🔍 Debugging streaming issue...\n');

  // Test direct fetch to edge function (you'll need to be authenticated)
  const url = 'https://npsqlaumhzzlqjtycpim.supabase.co/functions/v1/chat-stream';
  
  console.log('1. Testing edge function URL...');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: You'll need to add Authorization header with valid token
      },
      body: JSON.stringify({
        message: 'Hello, test message',
      }),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error:', errorText);
    } else {
      console.log('✅ Edge function is responding');
    }
  } catch (error) {
    console.error('❌ Fetch failed:', error);
  }

  console.log('\n2. Checking Supabase secrets...');
  // This would require supabase CLI to be authenticated
  
  console.log('\n3. Checking OpenAI API key format...');
  // Look for common issues:
  console.log('- API key should start with "sk-"');
  console.log('- API key should be from the correct OpenAI organization');
  console.log('- Check rate limits and billing status');
  
  console.log('\n4. Browser debugging tips:');
  console.log('- Open DevTools → Network tab');
  console.log('- Send a chat message');
  console.log('- Look for /functions/v1/chat-stream request');
  console.log('- Check response status and content-type');
  console.log('- Verify response contains SSE data');
}

debugStreamIssue().catch(console.error);