#!/bin/bash

# Deploy the updated chat-stream function to Supabase

echo "🚀 Deploying chat-stream function..."

# Check if we're in the right directory
if [ ! -f "supabase/functions/chat-stream/index.ts" ]; then
    echo "❌ Error: Not in the project root directory"
    exit 1
fi

# Deploy the function
echo "📦 Deploying to Supabase..."
npx supabase functions deploy chat-stream --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed chat-stream function!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Make sure OPENAI_API_KEY is set in your Supabase project secrets"
    echo "2. Test the chat functionality in your app"
    echo ""
    echo "To set the OpenAI API key (if not already set):"
    echo "npx supabase secrets set OPENAI_API_KEY=your-api-key-here"
else
    echo "❌ Deployment failed!"
    exit 1
fi