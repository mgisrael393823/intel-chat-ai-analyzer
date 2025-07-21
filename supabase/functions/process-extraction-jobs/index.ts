import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// This function runs on a schedule (cron) to process extraction jobs
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Use service role for system operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get pending jobs ordered by priority and creation time
    const { data: jobs, error: jobsError } = await supabaseClient
      .from('extraction_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5) // Process up to 5 jobs per run

    if (jobsError) {
      console.error('Failed to fetch jobs:', jobsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch jobs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${jobs?.length || 0} extraction jobs...`)

    const results = []
    
    // Process jobs in parallel with concurrency limit
    const processJob = async (job: { id: string }) => {
      try {
        // Mark job as processing
        await supabaseClient
          .from('extraction_jobs')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', job.id)

        // Get document owner for auth
        const { data: document } = await supabaseClient
          .from('documents')
          .select('user_id')
          .eq('id', job.document_id)
          .single()

        if (!document) {
          throw new Error('Document not found')
        }

        // Invoke extraction function
        const { data, error } = await supabaseClient.functions.invoke('extract-pdf-text', {
          body: { documentId: job.document_id },
          headers: {
            // Use service role to act on behalf of user
            'X-User-Id': document.user_id
          }
        })

        if (error) {
          throw error
        }

        // Mark job as complete
        await supabaseClient
          .from('extraction_jobs')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id)

        return { jobId: job.id, success: true }
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error)
        
        // Mark job as failed
        await supabaseClient
          .from('extraction_jobs')
          .update({ 
            status: 'failed',
            error: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id)

        return { jobId: job.id, success: false, error: error.message }
      }
    }

    // Process jobs with concurrency limit of 3
    const concurrencyLimit = 3
    for (let i = 0; i < (jobs?.length || 0); i += concurrencyLimit) {
      const batch = jobs?.slice(i, i + concurrencyLimit) || []
      const batchResults = await Promise.all(batch.map(processJob))
      results.push(...batchResults)
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Job processor error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})