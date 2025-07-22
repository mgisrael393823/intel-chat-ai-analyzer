-- Fix RLS policies to allow anonymous access for testing
-- This allows the service role to create threads and messages

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own threads" ON threads;
DROP POLICY IF EXISTS "Users can create own threads" ON threads;
DROP POLICY IF EXISTS "Users can update own threads" ON threads;
DROP POLICY IF EXISTS "Users can delete own threads" ON threads;

DROP POLICY IF EXISTS "Users can view messages in their threads" ON messages;
DROP POLICY IF EXISTS "Users can create messages in their threads" ON messages;

-- Create new policies that allow service role full access
-- and users to access their own data

-- Threads policies
CREATE POLICY "Service role has full access to threads" 
ON threads 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Users can view own threads" 
ON threads 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own threads" 
ON threads 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads" 
ON threads 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Service role has full access to messages" 
ON messages 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Users can view messages in their threads" 
ON messages 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM threads 
    WHERE threads.id = messages.thread_id 
    AND threads.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create messages in their threads" 
ON messages 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM threads 
    WHERE threads.id = messages.thread_id 
    AND threads.user_id = auth.uid()
  )
);

-- Documents policies (ensure service role access)
DROP POLICY IF EXISTS "Service role has full access to documents" ON documents;

CREATE POLICY "Service role has full access to documents" 
ON documents 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);