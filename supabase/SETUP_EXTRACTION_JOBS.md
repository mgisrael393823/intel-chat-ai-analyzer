# Setting Up PDF Extraction Jobs

## 1. Apply the Migration

First, you need to run the migration to create the `extraction_jobs` table:

```bash
supabase migration up
```

Or if you're using the Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to Database → Migrations
3. Run the migration `20250716000005_create_extraction_jobs.sql`

## 2. Verify the Table Creation

In the Supabase dashboard:
1. Go to Table Editor
2. You should see the `extraction_jobs` table with these columns:
   - `id` (UUID, Primary Key)
   - `document_id` (UUID, Foreign Key to documents)
   - `status` (Text: pending/processing/completed/failed)
   - `priority` (Text: low/normal/high)
   - `error` (Text, nullable)
   - `started_at` (Timestamptz, nullable)
   - `completed_at` (Timestamptz, nullable)
   - `created_at` (Timestamptz)

## 3. Configure the Cron Job (Optional)

To process extraction jobs automatically, you can set up a cron job in Supabase:

1. Go to Database → Extensions
2. Enable the `pg_cron` extension if not already enabled
3. Go to SQL Editor and run:

```sql
-- Schedule the job processor to run every minute
SELECT cron.schedule(
  'process-extraction-jobs',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://npsqlaumhzzlqjtycpim.supabase.co/functions/v1/process-extraction-jobs',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Note: Replace the URL with your actual Supabase project URL.

## 4. How It Works

1. When a PDF is uploaded via the `upload-pdf` function:
   - The document is created with `status: 'processing'`
   - An extraction job is automatically created (via trigger or manual insert)
   - The function returns immediately without waiting for extraction

2. The extraction jobs are processed by:
   - **Automatic trigger**: When document status changes to 'processing'
   - **Cron job**: Runs every minute to process pending jobs
   - **Fallback**: Direct invocation if job creation fails

3. Job processing flow:
   - Jobs are processed in priority order (high → normal → low)
   - Within same priority, older jobs are processed first
   - Up to 5 jobs are processed per run
   - Jobs are processed with a concurrency limit of 3

## 5. Monitoring Jobs

To monitor extraction jobs:

```sql
-- View all pending jobs
SELECT * FROM extraction_jobs WHERE status = 'pending' ORDER BY priority DESC, created_at;

-- View failed jobs
SELECT * FROM extraction_jobs WHERE status = 'failed' ORDER BY created_at DESC;

-- View job statistics
SELECT 
  status, 
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
FROM extraction_jobs
WHERE started_at IS NOT NULL
GROUP BY status;
```

## 6. Troubleshooting

If documents are stuck in 'processing' status:

1. Check if extraction jobs exist:
   ```sql
   SELECT * FROM extraction_jobs WHERE document_id = 'YOUR_DOCUMENT_ID';
   ```

2. Check for failed jobs:
   ```sql
   SELECT * FROM extraction_jobs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10;
   ```

3. Manually retry a failed job:
   ```sql
   UPDATE extraction_jobs 
   SET status = 'pending', error = NULL, started_at = NULL, completed_at = NULL
   WHERE id = 'JOB_ID';
   ```

4. Check Edge Function logs in Supabase dashboard under Functions → Logs