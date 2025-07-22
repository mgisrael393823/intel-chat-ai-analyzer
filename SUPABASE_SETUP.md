# Supabase Setup Instructions

## Issues Found and Solutions

### 1. Chat Function Authentication
The chat-stream function requires proper authentication setup. Here are the solutions:

#### Option A: Use Authenticated Requests (Recommended)
Ensure users are signed in before using chat functionality. The app already handles this with the ProtectedRoute component.

#### Option B: Enable Anonymous Access (For Testing)
1. Go to Supabase Dashboard > Authentication > Settings
2. Enable "Allow anonymous sign-ins"
3. The chat function will automatically create anonymous sessions for unauthenticated users

### 2. Database Permissions
The following tables need proper RLS policies:
- `threads` - for conversation management
- `messages` - for storing chat messages
- `documents` - for PDF storage

Run this SQL in the Supabase SQL Editor:

```sql
-- Ensure service role can bypass RLS
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage their own data
CREATE POLICY "Users can manage own threads" ON threads
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own documents" ON documents
  FOR ALL USING (auth.uid() = user_id);

-- Allow users to see messages in their threads
CREATE POLICY "Users can view thread messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM threads 
      WHERE threads.id = messages.thread_id 
      AND threads.user_id = auth.uid()
    )
  );
```

### 3. Environment Variables
Ensure these are set in Supabase Edge Functions:
- `OPENAI_API_KEY` - Your OpenAI API key

### 4. Testing the Setup
1. Sign in to the app
2. Upload a PDF document
3. Wait for processing to complete
4. Send a message in the chat

### 5. Debugging
Check function logs:
```bash
# View logs in Supabase Dashboard
# Functions > chat-stream > Logs
```

Common errors:
- "Unauthorized" - User not signed in
- "Failed to create thread" - RLS policies not set correctly
- "OpenAI API error" - Check OPENAI_API_KEY is set