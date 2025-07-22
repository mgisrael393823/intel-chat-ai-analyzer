#!/bin/bash

echo "🧪 Testing chat-stream function..."

# Get the Supabase URL and anon key
SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local 2>/dev/null | cut -d '=' -f2)
SUPABASE_ANON_KEY=$(grep VITE_SUPABASE_ANON_KEY .env.local 2>/dev/null | cut -d '=' -f2)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: Could not find Supabase credentials in .env.local"
    echo "Please make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set"
    exit 1
fi

# Remove quotes if present
SUPABASE_URL="${SUPABASE_URL%\"}"
SUPABASE_URL="${SUPABASE_URL#\"}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY%\"}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY#\"}"

echo "📡 Testing function at: $SUPABASE_URL/functions/v1/chat-stream"

# Test the function
curl -X POST "$SUPABASE_URL/functions/v1/chat-stream" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, this is a test",
    "threadId": null,
    "documentId": null
  }' \
  -N

echo -e "\n\n✅ Test complete!"