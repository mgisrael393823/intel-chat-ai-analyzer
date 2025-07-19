#!/bin/bash

# Test OpenAI API key
# Usage: ./test-openai-key.sh sk-your-api-key

if [ -z "$1" ]; then
    echo "Usage: ./test-openai-key.sh sk-your-api-key"
    exit 1
fi

API_KEY="$1"

echo "🔑 Testing OpenAI API key..."
echo "Key format: ${API_KEY:0:10}...${API_KEY: -10}"

# Test API key with a simple request
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 5
  }' \
  https://api.openai.com/v1/chat/completions