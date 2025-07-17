-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email, subscription_plan, subscription_status)
  values (new.id, new.email, 'free', 'active');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to automatically create user profile on signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update RLS policies to be more specific and secure
-- Documents table policies (replace existing ones)
drop policy if exists "Users can view own documents" on public.documents;
drop policy if exists "Users can insert own documents" on public.documents;
drop policy if exists "Users can update own documents" on public.documents;
drop policy if exists "Users can delete own documents" on public.documents;

create policy "Users can view own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

-- Threads table policies (replace existing ones)
drop policy if exists "Users can view own threads" on public.threads;
drop policy if exists "Users can insert own threads" on public.threads;
drop policy if exists "Users can update own threads" on public.threads;
drop policy if exists "Users can delete own threads" on public.threads;

create policy "Users can view own threads"
  on public.threads for select
  using (auth.uid() = user_id);

create policy "Users can insert own threads"
  on public.threads for insert
  with check (auth.uid() = user_id);

create policy "Users can update own threads"
  on public.threads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own threads"
  on public.threads for delete
  using (auth.uid() = user_id);

-- Messages table policies (replace existing ones)
drop policy if exists "Users can view messages from own threads" on public.messages;
drop policy if exists "Users can insert messages to own threads" on public.messages;
drop policy if exists "Users can update messages in own threads" on public.messages;

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
  ))
  with check (exists (
    select 1 from public.threads
    where threads.id = messages.thread_id
    and threads.user_id = auth.uid()
  ));

-- Usage logs policies (replace existing ones)
drop policy if exists "Users can view own usage logs" on public.usage_logs;
drop policy if exists "System can insert usage logs" on public.usage_logs;

create policy "Users can view own usage logs"
  on public.usage_logs for select
  using (auth.uid() = user_id);

create policy "System can insert usage logs"
  on public.usage_logs for insert
  with check (true); -- Edge functions will insert usage logs

-- User profiles policies (these should already exist, but let's be explicit)
drop policy if exists "Users can view own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;

create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);