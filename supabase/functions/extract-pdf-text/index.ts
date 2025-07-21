import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Use pdf-parse for now until we fix pdfjs-dist imports
import pdf from 'https://esm.sh/pdf-parse@1.1.1'

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
      // Extract the file path from storage URL
      // Storage URL format: https://[project].supabase.co/storage/v1/object/public/documents/[userId]/[fileId].pdf
      const urlParts = document.storage_url.split('/');
      const fileName = urlParts.slice(-2).join('/'); // Get userId/fileId.pdf
      
      console.log('Downloading file from storage:', fileName);
      
      // Download the PDF file from storage
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('documents')
        .download(fileName)

      if (downloadError || !fileData) {
        console.error('Download error:', downloadError);
        console.error('File path attempted:', fileName);
        console.error('Storage URL:', document.storage_url);
        throw new Error(`Failed to download PDF file: ${downloadError?.message || 'No file data'}`)
      }

      // Convert file to buffer for pdf-parse
      const buffer = await fileData.arrayBuffer()
      
      // Configuration for optimized extraction
      const MAX_PAGES = 10
      const MAX_CHARS = 100000
      
      let extractedText = ''
      
      try {
        console.log('Starting optimized PDF extraction...')
        const startTime = Date.now()
        
        // Extract text using pdf-parse with page limit
        const data = await pdf(buffer, {
          max: MAX_PAGES // Limit to first 10 pages
        })
        
        console.log(`PDF info: ${data.numpages} total pages, processing first ${Math.min(MAX_PAGES, data.numpages)} pages`)
        
        // Get the extracted text
        extractedText = data.text
        
        // Apply character limit
        if (extractedText.length > MAX_CHARS) {
          extractedText = extractedText.slice(0, MAX_CHARS) + '\n\n[Content truncated at 100k character limit]'
        }
        
        const extractionTime = Date.now() - startTime
        console.log('Extraction complete:', {
          totalPages: data.numpages,
          pagesProcessed: Math.min(MAX_PAGES, data.numpages),
          charactersExtracted: extractedText.length,
          timeMs: extractionTime,
          timePerPage: Math.round(extractionTime / Math.min(MAX_PAGES, data.numpages))
        })
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError)
        throw new Error('Failed to parse PDF content')
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