import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user has reached upload limit (for free plan)
    const { data: profile } = await supabaseClient
      .from('user_profiles')
      .select('subscription_plan')
      .eq('id', user.id)
      .single()

    // For free plan, check monthly upload count
    if (profile?.subscription_plan === 'free') {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: usageCount } = await supabaseClient
        .from('usage_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('action', 'document_upload')
        .gte('created_at', startOfMonth.toISOString())

      if (usageCount && usageCount.length >= 5) {
        return new Response(
          JSON.stringify({ 
            error: 'Upload limit reached. Upgrade to Pro for unlimited uploads.' 
          }),
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Parse the multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate file type and size
    if (file.type !== 'application/pdf') {
      return new Response(
        JSON.stringify({ error: 'Only PDF files are allowed' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return new Response(
        JSON.stringify({ error: 'File size must be less than 10MB' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate unique filename
    const fileExt = 'pdf'
    const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Failed to upload file' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabaseClient.storage
      .from('documents')
      .getPublicUrl(fileName)

    // Create document record in database
    const { data: documentData, error: dbError } = await supabaseClient
      .from('documents')
      .insert({
        user_id: user.id,
        name: file.name,
        size: file.size,
        type: file.type,
        storage_url: urlData.publicUrl,
        status: 'processing', // Will be updated by text extraction function
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Clean up uploaded file if database insert fails
      await supabaseClient.storage
        .from('documents')
        .remove([fileName])
      
      return new Response(
        JSON.stringify({ error: 'Failed to save document record' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log the upload for usage tracking
    await supabaseClient
      .from('usage_logs')
      .insert({
        user_id: user.id,
        action: 'document_upload',
        document_id: documentData.id,
      })

    // Trigger PDF text extraction asynchronously but don't await
    console.log('Triggering PDF extraction for document:', documentData.id)
    
    // Create a promise for the extraction but don't await it
    const extractionPromise = supabaseClient.functions.invoke('extract-pdf-text', {
      body: { documentId: documentData.id },
      headers: {
        Authorization: req.headers.get('Authorization')!,
      }
    }).then((result) => {
      console.log('PDF extraction completed for:', documentData.id, result)
    }).catch(async (error) => {
      console.error('PDF extraction failed:', error)
      // Update document status to error
      try {
        await supabaseClient
          .from('documents')
          .update({ 
            status: 'error',
            error_message: error.message || 'Failed to extract text from PDF'
          })
          .eq('id', documentData.id)
      } catch (updateError) {
        console.error('Failed to update document status:', updateError)
      }
    })
    
    // Don't wait for extraction to complete
    
    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        document: documentData,
        message: 'File uploaded successfully! Processing in background...'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})