-- Create threads table for chat conversations
create table if not exists public.threads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  document_id uuid references public.documents(id) on delete cascade,
  title text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Create messages table for chat messages
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.threads(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  status text default 'sent' check (status in ('sending', 'sent', 'error', 'streaming')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Create user_profiles table for subscription tracking
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  subscription_plan text default 'free' check (subscription_plan in ('free', 'pro')),
  subscription_status text default 'active' check (subscription_status in ('active', 'cancelled', 'past_due')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_started_at timestamptz default now(),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Create usage_logs table for tracking uploads per month
create table if not exists public.usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  action text not null check (action in ('document_upload', 'chat_message')),
  document_id uuid references public.documents(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Indexes for performance
create index if not exists threads_user_id_idx on public.threads(user_id);
create index if not exists threads_document_id_idx on public.threads(document_id);
create index if not exists threads_created_at_idx on public.threads(created_at desc);

create index if not exists messages_thread_id_idx on public.messages(thread_id);
create index if not exists messages_created_at_idx on public.messages(created_at);

create index if not exists usage_logs_user_id_idx on public.usage_logs(user_id);
create index if not exists usage_logs_created_at_idx on public.usage_logs(created_at desc);

-- Enable RLS for all tables
alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.user_profiles enable row level security;
alter table public.usage_logs enable row level security;

-- RLS policies for threads
create policy "Users can view own threads"
  on public.threads for select
  using (auth.uid() = user_id);

create policy "Users can insert own threads"
  on public.threads for insert
  with check (auth.uid() = user_id);

create policy "Users can update own threads"
  on public.threads for update
  using (auth.uid() = user_id);

create policy "Users can delete own threads"
  on public.threads for delete
  using (auth.uid() = user_id);

-- RLS policies for messages
create policy "Users can view messages from own threads"
  on public.messages for select
  using (exists (
    select 1 from public.threads
    where threads.id = messages.thread_id
    and threads.user_id = auth.uid()
  ));

create policy "Users can insert messages to own threads"
  on public.messages for insert
  with check (exists (
    select 1 from public.threads
    where threads.id = messages.thread_id
    and threads.user_id = auth.uid()
  ));

create policy "Users can update messages in own threads"
  on public.messages for update
  using (exists (
    select 1 from public.threads
    where threads.id = messages.thread_id
    and threads.user_id = auth.uid()
  ));

-- RLS policies for user_profiles
create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

-- RLS policies for usage_logs
create policy "Users can view own usage logs"
  on public.usage_logs for select
  using (auth.uid() = user_id);

create policy "System can insert usage logs"
  on public.usage_logs for insert
  with check (true); -- Edge functions will insert usage logs

-- Add updated_at triggers
create trigger handle_threads_updated_at
  before update on public.threads
  for each row execute function public.handle_updated_at();

create trigger handle_messages_updated_at
  before update on public.messages
  for each row execute function public.handle_updated_at();

create trigger handle_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.handle_updated_at();