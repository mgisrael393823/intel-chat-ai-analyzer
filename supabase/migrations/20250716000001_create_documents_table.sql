-- Create documents table for PDF file tracking and text storage
create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  size bigint not null,
  type text not null default 'application/pdf',
  storage_url text not null,
  extracted_text text,
  status text not null default 'uploading' check (status in ('uploading', 'processing', 'ready', 'error')),
  upload_progress integer default 0 check (upload_progress >= 0 and upload_progress <= 100),
  error_message text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Create index for faster queries
create index if not exists documents_user_id_idx on public.documents(user_id);
create index if not exists documents_status_idx on public.documents(status);
create index if not exists documents_created_at_idx on public.documents(created_at desc);

-- Enable RLS (Row Level Security)
alter table public.documents enable row level security;

-- RLS policies
create policy "Users can view own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id);

create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger handle_documents_updated_at
  before update on public.documents
  for each row execute function public.handle_updated_at();