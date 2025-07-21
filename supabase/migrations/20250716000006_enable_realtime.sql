-- Enable realtime for documents table to track status updates
alter publication supabase_realtime add table public.documents;

-- Enable realtime for messages table for chat updates  
alter publication supabase_realtime add table public.messages;

-- Enable realtime for threads table
alter publication supabase_realtime add table public.threads;

-- Create function to notify document status changes
create or replace function notify_document_status_change()
returns trigger as $$
begin
  if (old.status is distinct from new.status) then
    perform pg_notify(
      'document_status_changed',
      json_build_object(
        'id', new.id,
        'status', new.status,
        'user_id', new.user_id
      )::text
    );
  end if;
  return new;
end;
$$ language plpgsql;

-- Create trigger for document status changes
create trigger on_document_status_change
  after update on public.documents
  for each row
  execute function notify_document_status_change();