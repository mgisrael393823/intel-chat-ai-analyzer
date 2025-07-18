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

    // Parse request body
    const { documentId } = await req.json()

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Document ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get document with extracted text
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('extracted_text, name')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!document.extracted_text) {
      return new Response(
        JSON.stringify({ error: 'Document text not yet extracted. Please wait for processing to complete.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Create extraction prompt
    const systemPrompt = `You are an expert commercial real estate analyst. Extract key deal metrics from the offering memorandum text provided.

Return a JSON object with the following structure:
{
  "propertyName": "string",
  "address": "string",
  "propertyType": "string (e.g., multifamily, office, retail, industrial)",
  "yearBuilt": number or null,
  "totalUnits": number or null,
  "squareFootage": number or null,
  "askingPrice": number or null,
  "noi": number or null,
  "capRate": number or null,
  "occupancy": number or null,
  "highlights": ["array of key investment highlights"],
  "risks": ["array of potential risks or concerns"],
  "marketOverview": "brief market summary",
  "sponsorInfo": "sponsor/seller information"
}

Important:
- Extract exact numbers when available
- Use null for missing data
- Cap rate should be a percentage (e.g., 6.5 for 6.5%)
- Financial figures should be raw numbers (e.g., 5000000 for $5M)
- Keep highlights and risks concise but informative`

    const userPrompt = `Extract the deal metrics from this offering memorandum:

${document.extracted_text}`

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const completion = await response.json()
    const extractedData = JSON.parse(completion.choices[0].message.content)

    // Log usage for tracking
    await supabaseClient
      .from('usage_logs')
      .insert({
        user_id: user.id,
        action: 'document_snapshot',
        document_id: documentId,
      })

    // Return the extracted snapshot
    return new Response(
      JSON.stringify({
        success: true,
        documentName: document.name,
        snapshot: extractedData,
        message: 'Deal snapshot extracted successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Snapshot generation error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate snapshot', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})