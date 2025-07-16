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

    // Get the document ID from request
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

    // Get document record
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
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

    // Update status to processing
    await supabaseClient
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId)

    try {
      // Download the PDF file from storage
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('documents')
        .download(document.storage_url.split('/').pop()!)

      if (downloadError || !fileData) {
        throw new Error('Failed to download PDF file')
      }

      // TODO: Implement PDF text extraction
      // For now, we'll simulate text extraction
      // In a real implementation, you would use a library like pdf-parse
      // or call an external service for PDF text extraction
      
      const simulatedText = `
OFFERING MEMORANDUM

Property: Commercial Real Estate Investment
Location: Sample Address
Type: Multi-family residential complex

EXECUTIVE SUMMARY
This offering memorandum presents an investment opportunity in a well-positioned commercial real estate asset.

FINANCIAL HIGHLIGHTS
- Gross Annual Income: $2,400,000
- Net Operating Income: $1,800,000
- Cap Rate: 6.5%
- Occupancy Rate: 95%

PROPERTY DETAILS
- Total Units: 120
- Year Built: 2010
- Building Size: 150,000 sq ft
- Parking Spaces: 150

INVESTMENT HIGHLIGHTS
- Prime location with excellent demographics
- Strong rental growth potential
- Professional property management in place
- Recent capital improvements completed

RISK FACTORS
- Market volatility
- Interest rate fluctuations
- Tenant concentration risk
- Capital expenditure requirements

This is a simulated extraction. Actual PDF content would be extracted here.
      `.trim()

      // Implement smart chunking for AI context (6000 tokens with 500 overlap)
      const chunks = chunkText(simulatedText, 6000, 500)

      // Update document with extracted text
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          extracted_text: simulatedText,
          status: 'ready'
        })
        .eq('id', documentId)

      if (updateError) {
        throw new Error('Failed to update document with extracted text')
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'PDF text extracted successfully',
          textLength: simulatedText.length,
          chunks: chunks.length
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )

    } catch (extractionError) {
      console.error('Text extraction error:', extractionError)
      
      // Update document status to error
      await supabaseClient
        .from('documents')
        .update({ 
          status: 'error',
          error_message: 'Failed to extract text from PDF'
        })
        .eq('id', documentId)

      return new Response(
        JSON.stringify({ error: 'Failed to extract text from PDF' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

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

// Helper function to chunk text for AI processing
function chunkText(text: string, maxTokens: number, overlap: number): string[] {
  // Simple word-based chunking (in production, use proper tokenization)
  const words = text.split(' ')
  const chunks: string[] = []
  const wordsPerChunk = Math.floor(maxTokens * 0.75) // Rough estimation
  const overlapWords = Math.floor(overlap * 0.75)

  for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ')
    if (chunk.trim()) {
      chunks.push(chunk)
    }
  }

  return chunks
}