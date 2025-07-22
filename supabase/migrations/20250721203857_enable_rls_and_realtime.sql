-- Ensure RLS and realtime publication for documents and extraction_jobs
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;
CREATE POLICY "Users can manage own documents"
  ON public.documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- The extraction_jobs table already exists, just ensure RLS is enabled
-- It uses document ownership for access control, not direct user_id
ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;

-- Add tables to realtime publication (ignore errors if already added)
DO $$ 
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already added, ignore
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.extraction_jobs;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already added, ignore
    END;
END $$;
