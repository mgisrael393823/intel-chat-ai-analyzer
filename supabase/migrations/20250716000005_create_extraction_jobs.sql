-- Create extraction_jobs table for managing PDF text extraction tasks
CREATE TABLE extraction_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for job processing
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_extraction_jobs_priority ON extraction_jobs(priority);
CREATE INDEX idx_extraction_jobs_document_id ON extraction_jobs(document_id);
CREATE INDEX idx_extraction_jobs_created_at ON extraction_jobs(created_at);

-- Enable RLS
ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view extraction jobs for their documents"
  ON extraction_jobs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = extraction_jobs.document_id
    AND documents.user_id = auth.uid()
  ));

CREATE POLICY "System can insert extraction jobs"
  ON extraction_jobs FOR INSERT
  WITH CHECK (true); -- Edge functions will create jobs

CREATE POLICY "System can update extraction jobs"
  ON extraction_jobs FOR UPDATE
  USING (true); -- Edge functions will update jobs

-- Note: Extraction jobs are created by the upload-pdf edge function
-- No automatic trigger needed as it's handled in the upload flow