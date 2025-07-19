#!/usr/bin/env tsx

// Test script to verify OpenAI API integration
// Run with: npx tsx test-openai.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://npsqlaumhzzlqjtycpim.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wc3FsYXVtaHp6bHFqdHljcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDAzMzAsImV4cCI6MjA2ODI3NjMzMH0.i_dRSQj_l5bpzHjKMeq58QjWwoa8Y2QikeZrav8-rxo";

async function testOpenAIIntegration() {
  console.log('🧪 Testing OpenAI Integration...\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // 1. Test authentication
  console.log('1. Testing authentication...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('❌ Not authenticated. Please sign in first.');
    console.log('\nTo test: Sign in through the app, then run this script again.');
    return;
  }
  
  console.log('✅ Authenticated as:', user.email);
  
  // 2. Test edge function directly
  console.log('\n2. Testing edge function...');
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('❌ No session found');
    return;
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hello, can you respond with a simple test message?',
        threadId: undefined,
        documentId: undefined,
      }),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return;
    }
    
    // 3. Test streaming
    console.log('\n3. Testing streaming response...');
    if (!response.body) {
      console.error('❌ No response body');
      return;
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let messageContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content') {
              messageContent += parsed.content;
              process.stdout.write(parsed.content);
            } else if (parsed.type === 'done') {
              console.log('\n\n✅ Streaming completed successfully!');
              console.log('Full message:', messageContent);
            } else if (parsed.type === 'error') {
              console.error('\n❌ Streaming error:', parsed.error);
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

// Run the test
testOpenAIIntegration().catch(console.error);