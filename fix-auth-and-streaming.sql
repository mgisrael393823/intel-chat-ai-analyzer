-- Fix authentication and streaming issues

-- 1. Ensure storage bucket exists and has correct permissions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'documents',
      'documents',
      false,
      10485760,
      array['application/pdf']
    );
  END IF;
END $$;

-- 2. Drop and recreate storage policies to ensure they work
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- Allow authenticated users to upload to their folder
CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to view their documents
CREATE POLICY "Users can view own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to update their documents
CREATE POLICY "Users can update own documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to delete their documents
CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. Enable realtime for status updates
DO $$
BEGIN
  -- Check if realtime is already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.threads;
  END IF;
END $$;

-- 4. Create extraction_jobs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.extraction_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add RLS policies for extraction_jobs
ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view extraction jobs for their documents"
  ON public.extraction_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = extraction_jobs.document_id
    AND documents.user_id = auth.uid()
  ));

-- 5. Grant necessary permissions to service role for edge functions
GRANT ALL ON public.documents TO service_role;
GRANT ALL ON public.threads TO service_role;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.usage_logs TO service_role;
GRANT ALL ON public.extraction_jobs TO service_role;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_thread_status ON public.messages(thread_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_user_status ON public.documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_threads_user_updated ON public.threads(user_id, updated_at DESC);