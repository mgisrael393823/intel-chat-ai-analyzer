# Chat Function Troubleshooting Guide

## Issue: 500 Error from chat-stream Function

### Root Cause
Multiple issues were found:
1. The original `chat-stream` function was expecting a different request format than what the client was sending:
   - **Client sends**: `{ message, threadId, documentId }`
   - **Original function expected**: `{ messages, model, temperature }`
2. The OpenAI library import was incorrect for Deno environment
3. The OpenAI client initialization syntax was wrong

### Solution Applied
Updated the `chat-stream` function to:
1. Accept the client's request format
2. Handle authentication properly
3. Create/manage threads and messages in the database
4. Include document context when available
5. Stream responses back to the client

### Deployment Steps

1. **Deploy the updated function**:
   ```bash
   ./deploy-chat-function.sh
   ```
   
   Or manually:
   ```bash
   npx supabase functions deploy chat-stream --no-verify-jwt
   ```

2. **Ensure environment variables are set**:
   ```bash
   # Check if OPENAI_API_KEY is set
   npx supabase secrets list
   
   # If not set, add it:
   npx supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here
   ```

3. **Verify database tables exist**:
   - `threads` table
   - `messages` table
   - `documents` table
   
   Run migrations if needed:
   ```bash
   npx supabase db push
   ```

### Testing the Fix

1. **Test basic chat without document**:
   - Sign in to the app
   - Send a message without uploading a document
   - Should receive a response about commercial real estate

2. **Test chat with document context**:
   - Upload a PDF document
   - Wait for processing to complete
   - Ask questions about the document
   - Should receive answers based on document content

3. **Test error scenarios**:
   - Try sending a message while signed out (should show auth error)
   - Try with invalid document ID (should still work, just without context)

### Common Issues and Solutions

#### Issue: Still getting 500 error
- **Check logs**: `npx supabase functions logs chat-stream`
- **Verify OPENAI_API_KEY**: Make sure it's set and valid
- **Check CORS**: Ensure your app's domain is allowed

#### Issue: "Unauthorized" error
- **Check auth token**: Ensure the user is properly authenticated
- **Verify RLS policies**: Check that the user has access to create threads/messages

#### Issue: No document context in responses
- **Check document status**: Ensure document.extracted_text is populated
- **Verify document ID**: Make sure the correct document ID is being sent

### Environment Variables Required
- `OPENAI_API_KEY`: Your OpenAI API key
- `SUPABASE_URL`: Automatically set by Supabase
- `SUPABASE_ANON_KEY`: Automatically set by Supabase

### Database Requirements
The function expects these tables with proper RLS policies:

1. **threads**:
   - id (uuid, primary key)
   - user_id (uuid, references auth.users)
   - document_id (uuid, nullable, references documents)
   - title (text)
   - created_at (timestamp)
   - updated_at (timestamp)

2. **messages**:
   - id (uuid, primary key)
   - thread_id (uuid, references threads)
   - role (text: 'user' or 'assistant')
   - content (text)
   - created_at (timestamp)

3. **documents**:
   - id (uuid, primary key)
   - user_id (uuid, references auth.users)
   - name (text)
   - extracted_text (text, nullable)
   - status (text)

### Monitoring
To monitor the function:
```bash
# View real-time logs
npx supabase functions logs chat-stream --tail

# Check function status
npx supabase functions list
```

### Client-Side Error Handling
The client now provides better error messages:
- Network errors: "Network error: Unable to connect to the server"
- Auth errors: "Authentication error: Please sign in again"
- Server errors: Shows the actual error message from the server

### Next Steps if Still Having Issues
1. Check Supabase dashboard for any service issues
2. Verify all migrations have been run
3. Test the function directly using curl:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/chat-stream \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello", "threadId": null, "documentId": null}'
   ```
4. Contact Supabase support if infrastructure issues persist