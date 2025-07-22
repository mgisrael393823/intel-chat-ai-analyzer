
-- Fix usage_logs constraint to allow document_snapshot action
ALTER TABLE public.usage_logs DROP CONSTRAINT IF EXISTS usage_logs_action_check;

-- Add new constraint with document_snapshot included
ALTER TABLE public.usage_logs ADD CONSTRAINT usage_logs_action_check 
CHECK (action = ANY (ARRAY['document_upload'::text, 'chat_message'::text, 'document_snapshot'::text]));

-- Enable RLS on extraction_jobs table
ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for extraction_jobs
CREATE POLICY "Users can view extraction jobs for their documents"
  ON public.extraction_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = extraction_jobs.document_id
    AND documents.user_id = auth.uid()
  ));

-- Allow system operations on extraction_jobs
CREATE POLICY "System can manage extraction jobs"
  ON public.extraction_jobs FOR ALL
  USING (true)
  WITH CHECK (true);
