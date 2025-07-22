import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

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
      console.log('Fetching PDF from storage URL:', document.storage_url);
      
      // Fetch PDF directly from storage URL
      const response = await fetch(document.storage_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
      }

      // Get PDF as ArrayBuffer for PDF.js
      const pdfBuffer = await response.arrayBuffer()
      
      // Configuration for optimized extraction
      const MAX_PAGES = 10
      const MAX_CHARS = 100000
      
      let extractedText = ''
      
      try {
        console.log('Starting simple PDF text extraction...')
        const startTime = Date.now()
        
        // Simple text extraction from PDF binary data
        const uint8Array = new Uint8Array(pdfBuffer)
        const text = extractTextFromPDFBinary(uint8Array)
        
        extractedText = text
        
        // Apply character limit
        if (extractedText.length > MAX_CHARS) {
          extractedText = extractedText.slice(0, MAX_CHARS) + '\n\n[Content truncated at 100k character limit]'
        }
        
        const extractionTime = Date.now() - startTime
        console.log('Extraction complete:', {
          charactersExtracted: extractedText.length,
          timeMs: extractionTime
        })
        
      } catch (pdfError) {
        console.error('PDF extraction error:', pdfError)
        throw new Error(`Failed to extract text from PDF: ${pdfError.message || 'Unknown error'}`)
      }
      
      // Validate extracted text
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text content found in PDF')
      }

      // Implement smart chunking for AI context (6000 tokens with 500 overlap)
      const chunks = chunkText(extractedText, 6000, 500)

      // Update document with extracted text
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          extracted_text: extractedText,
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
          textLength: extractedText.length,
          chunks: chunks.length
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )

    } catch (extractionError) {
      console.error('Text extraction error:', extractionError)
      console.error('Document ID:', documentId)
      console.error('Document data:', document)
      
      const errorMessage = extractionError instanceof Error 
        ? extractionError.message 
        : 'Failed to extract text from PDF';
      
      // Update document status to error with detailed message
      await supabaseClient
        .from('documents')
        .update({ 
          status: 'error',
          error_message: errorMessage
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

// Simple PDF text extraction from binary data
function extractTextFromPDFBinary(pdfData: Uint8Array): string {
  const textDecoder = new TextDecoder('utf-8', { fatal: false })
  const pdfString = textDecoder.decode(pdfData)
  
  // Look for text objects in PDF structure
  const textMatches = []
  
  // Match PDF text strings - pattern for text between parentheses or brackets
  const textRegexes = [
    /\((.*?)\)/g,  // Text in parentheses
    /\[(.*?)\]/g,  // Text in brackets  
    /BT\s+(.*?)\s+ET/g, // Text between BT (Begin Text) and ET (End Text)
    /Tj\s*\((.*?)\)/g, // Tj operator with text
    /TJ\s*\[(.*?)\]/g  // TJ operator with text array
  ]
  
  for (const regex of textRegexes) {
    let match
    while ((match = regex.exec(pdfString)) !== null) {
      const text = match[1]
      if (text && text.trim() && text.length > 1) {
        // Clean up the text
        const cleanText = text
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\')
          .replace(/\\\)/g, ')')
          .replace(/\\\(/g, '(')
          .trim()
        
        if (cleanText.length > 2 && !cleanText.match(/^[0-9\s\.]+$/)) {
          textMatches.push(cleanText)
        }
      }
    }
  }
  
  // Also try to extract readable ASCII text directly
  const asciiText = pdfString.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
  const words = asciiText.split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      word.match(/[a-zA-Z]/) && 
      !word.match(/^[0-9\.]+$/)
    )
  
  // Combine extracted text
  const allText = [...textMatches, ...words].join(' ')
  
  // Clean up and format the text
  return allText
    .replace(/\s+/g, ' ')
    .replace(/(.{100})/g, '$1\n') // Add line breaks for readability
    .trim()
}

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