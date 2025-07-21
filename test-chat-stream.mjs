import fetch from 'node-fetch';

const supabaseUrl = 'https://npsqlaumhzzlqjtycpim.supabase.co';
const token = process.argv[2];

if (!token) {
  console.error('Usage: node test-chat-stream.mjs <your-jwt-token>');
  console.log('Get your token from browser localStorage: sb-npsqlaumhzzlqjtycpim-auth-token');
  process.exit(1);
}

async function testChatStream() {
  console.log('🧪 Testing chat-stream endpoint...');
  
  const response = await fetch(`${supabaseUrl}/functions/v1/chat-stream`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Hello, this is a test message',
      threadId: null,
      documentId: null
    }),
  });

  console.log('📡 Response status:', response.status);
  console.log('📡 Response headers:', response.headers.raw());

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Error response:', error);
    return;
  }

  console.log('✅ Starting to read stream...');
  
  const reader = response.body;
  reader.on('data', (chunk) => {
    const text = chunk.toString();
    console.log('📦 Chunk received:', text);
  });

  reader.on('end', () => {
    console.log('✅ Stream ended');
  });

  reader.on('error', (err) => {
    console.error('❌ Stream error:', err);
  });
}

testChatStream();