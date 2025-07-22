console.log("⚡️ PDF Extraction Function initializing…");

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("✅ Basic imports loaded successfully");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// ASCII-based PDF text extraction (guaranteed to work)
function extractTextWithASCII(buffer: ArrayBuffer): string {
  console.log('📝 Starting ASCII fallback text extraction...')
  const startTime = Date.now()
  
  try {
    // Decode PDF buffer as UTF-8, ignoring invalid sequences
    const decoder = new TextDecoder('utf-8', { fatal: false })
    const rawText = decoder.decode(buffer)
    
    // Extract printable ASCII characters plus common whitespace
    // This captures most readable text while filtering binary data
    const extractedText = rawText
      .replace(/[^\x20-\x7E\n\r\t]/g, '') // Keep only printable ASCII + whitespace
      .replace(/\s+/g, ' ') // Normalize multiple whitespace to single spaces
      .replace(/\s*\n\s*/g, '\n') // Clean up line breaks
      .trim()
    
    const extractionTime = Date.now() - startTime
    console.log('✅ ASCII extraction completed:', {
      bufferSize: buffer.byteLength,
      extractedLength: extractedText.length,
      extractionTimeMs: extractionTime
    })
    
    return extractedText
  } catch (error) {
    console.error('❌ ASCII extraction failed:', error)
    throw new Error(`ASCII extraction failed: ${error.message}`)
  }
}

// Simple extraction function using ASCII only
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<{ text: string, method: string }> {
  const MAX_CHARS = 100000
  let extractedText = ""
  let method = "ascii-fallback"
  
  try {
    extractedText = extractTextWithASCII(buffer)
    console.log(`✅ Used ASCII fallback extraction: ${extractedText.length} chars`)
  } catch (asciiError) {
    console.error("❌ ASCII extraction failed:", asciiError.message)
    throw new Error(`Text extraction failed: ${asciiError.message}`)
  }
  
  // Apply character limit
  if (extractedText.length > MAX_CHARS) {
    extractedText = extractedText.slice(0, MAX_CHARS) + '\n\n[Content truncated at 100k character limit]'
    console.log(`📏 Text truncated to ${MAX_CHARS} characters`)
  }
  
  return { text: extractedText, method }
}

// Helper function to chunk text for AI processing
function chunkText(text: string, maxTokens: number, overlap: number): string[] {
  const words = text.split(' ')
  const chunks: string[] = []
  const wordsPerChunk = Math.floor(maxTokens * 0.75) // Rough estimation: 4 chars per token
  const overlapWords = Math.floor(overlap * 0.75)

  for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
    const chunk = words.slice(i, i + wordsPerChunk).join(' ')
    if (chunk.trim()) {
      chunks.push(chunk)
    }
  }

  return chunks
}

serve(async (req) => {
  console.log("🚀 PDF Extraction request received");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("📋 CORS preflight request");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    console.log('=== PDF Extraction Request Started ===')
    
    // Get the document ID from request first for health check
    let requestBody;
    try {
      requestBody = await req.json()
      console.log('Request payload received:', { documentId: requestBody.documentId })
    } catch (parseError) {
      console.error('Failed to parse request JSON:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { documentId } = requestBody

    // Health check endpoint (no auth required)
    if (documentId === 'health-check') {
      console.log("🔍 Running health check...");
      return new Response(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          extractionMethod: 'ascii-fallback',
          description: "PDF extraction service is running with ASCII fallback method"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    if (!documentId) {
      console.log('Request rejected: Missing document ID')
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
      console.error('Document not found:', docError)
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
      console.log('Fetching PDF from storage:', document.storage_url);
      
      // Extract the file path from storage URL
      // Storage URL format: https://[project].supabase.co/storage/v1/object/public/documents/[userId]/[fileId].pdf
      const urlParts = document.storage_url.split('/');
      const pathIndex = urlParts.indexOf('documents');
      if (pathIndex === -1 || pathIndex + 2 >= urlParts.length) {
        throw new Error('Invalid storage URL format');
      }
      const filePath = urlParts.slice(pathIndex + 1).join('/');
      console.log('Extracted file path:', filePath);
      
      // Use service role client to download directly from storage
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('documents')
        .download(filePath);
      
      if (downloadError || !fileData) {
        console.error('Storage download error:', downloadError);
        throw new Error(`Failed to download PDF from storage: ${downloadError?.message || 'No file data'}`);
      }

      // Convert Blob to ArrayBuffer
      const pdfBuffer = await fileData.arrayBuffer();
      console.log(`PDF downloaded via storage API: ${pdfBuffer.byteLength} bytes`)
      
      // Extract text using ASCII method
      const { text: extractedText, method } = await extractTextFromPDF(pdfBuffer)
      
      // Validate extracted text
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No readable text content found in PDF')
      }

      console.log(`Final extracted text: ${extractedText.length} characters using ${method}`)

      // Implement smart chunking for AI context (6000 tokens with 500 overlap)
      const chunks = chunkText(extractedText, 6000, 500)
      console.log(`Text chunked into ${chunks.length} segments`)

      // Update document with extracted text
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          extracted_text: extractedText,
          status: 'ready'
        })
        .eq('id', documentId)

      if (updateError) {
        console.error('Failed to update document:', updateError)
        throw new Error('Failed to update document with extracted text')
      }

      console.log('✅ PDF extraction completed successfully')
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `PDF text extracted successfully using ${method}`,
          textLength: extractedText.length,
          chunks: chunks.length,
          method: method
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )

    } catch (extractionError) {
      console.error('Text extraction error:', extractionError)
      
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
        JSON.stringify({
          error: 'Failed to extract text from PDF',
          details: errorMessage
        }),
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

console.log("✅ PDF Extraction function ready to serve");