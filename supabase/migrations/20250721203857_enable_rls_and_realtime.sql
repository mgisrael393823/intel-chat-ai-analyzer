-- Ensure RLS and realtime publication for documents and extraction_jobs
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;
CREATE POLICY "Users can manage own documents"
  ON public.documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.extraction_jobs (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text default 'pending',
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own jobs" ON public.extraction_jobs;
CREATE POLICY "Users can manage own jobs"
  ON public.extraction_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.extraction_jobs;
