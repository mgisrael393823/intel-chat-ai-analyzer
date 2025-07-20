import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Import pdfjs-dist for faster WebAssembly-based parsing
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.min.mjs'
import pdfjsWorker from 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.mjs?worker'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

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

      // Convert file to buffer for parsing
      const buffer = await fileData.arrayBuffer()
      const uint8Array = new Uint8Array(buffer)
      
      // Configuration for optimized extraction
      const MAX_PAGES = 10
      const MAX_CHARS = 100000
      const FINANCIAL_KEYWORDS = [
        /\b(noi|net\s+operating\s+income)\b/i,
        /\b(cap\s+rate|capitalization\s+rate)\b/i,
        /\b(rent\s+roll)\b/i,
        /\b(financial\s+(highlights|summary))\b/i,
        /\b(income\s+statement)\b/i,
        /\b(cash\s+flow)\b/i,
        /\b(returns?\s+analysis)\b/i,
        /\b(irr|internal\s+rate\s+of\s+return)\b/i,
      ]
      
      let extractedText = ''
      let totalChars = 0
      const foundSections = new Set<string>()
      
      try {
        console.log('Starting optimized WebAssembly PDF extraction...')
        const startTime = Date.now()
        
        // Load PDF document with pdfjs-dist
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array })
        const pdfDoc = await loadingTask.promise
        const numPages = Math.min(pdfDoc.numPages, MAX_PAGES)
        
        console.log(`Processing ${numPages} of ${pdfDoc.numPages} pages...`)
        
        // Extract text page by page with streaming updates
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          if (totalChars >= MAX_CHARS) {
            console.log(`Character limit reached at page ${pageNum}`)
            break
          }
          
          const page = await pdfDoc.getPage(pageNum)
          const textContent = await page.getTextContent()
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
          
          // Check for financial keywords
          for (const keyword of FINANCIAL_KEYWORDS) {
            if (keyword.test(pageText)) {
              const keywordName = keyword.source.replace(/[\\()]/g, '')
              foundSections.add(keywordName)
              console.log(`Found financial section: ${keywordName} on page ${pageNum}`)
            }
          }
          
          extractedText += `\n--- Page ${pageNum} ---\n${pageText}\n`
          totalChars += pageText.length
          
          // Log progress every 3 pages
          if (pageNum % 3 === 0) {
            console.log(`Progress: ${pageNum}/${numPages} pages, ${totalChars} chars, ${foundSections.size} financial sections found`)
          }
          
          // Early exit if all financial sections found
          if (foundSections.size >= FINANCIAL_KEYWORDS.length * 0.8) {
            console.log(`Found most financial sections by page ${pageNum}, stopping early`)
            break
          }
        }
        
        // Apply final character limit
        if (extractedText.length > MAX_CHARS) {
          extractedText = extractedText.slice(0, MAX_CHARS) + '\n\n[Content truncated at 100k character limit]'
        }
        
        const extractionTime = Date.now() - startTime
        console.log('Extraction complete:', {
          totalPages: pdfDoc.numPages,
          pagesProcessed: Math.min(numPages, MAX_PAGES),
          charactersExtracted: extractedText.length,
          financialSectionsFound: Array.from(foundSections),
          timeMs: extractionTime,
          timePerPage: Math.round(extractionTime / numPages)
        })
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError)
        // Fallback to pdftotext if available
        try {
          console.log('Attempting fallback with pdftotext...')
          const tempFile = await Deno.makeTempFile({ suffix: '.pdf' })
          await Deno.writeFile(tempFile, uint8Array)
          
          const command = new Deno.Command('pdftotext', {
            args: ['-f', '1', '-l', '10', '-layout', tempFile, '-'],
            stdout: 'piped',
            stderr: 'piped',
          })
          
          const { stdout, stderr } = await command.output()
          
          if (stderr.length > 0) {
            console.error('pdftotext error:', new TextDecoder().decode(stderr))
          }
          
          extractedText = new TextDecoder().decode(stdout)
          await Deno.remove(tempFile)
          
          // Apply character limit
          if (extractedText.length > MAX_CHARS) {
            extractedText = extractedText.slice(0, MAX_CHARS)
          }
        } catch (fallbackError) {
          console.error('Fallback extraction failed:', fallbackError)
          throw new Error('Failed to parse PDF content with both methods')
        }
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