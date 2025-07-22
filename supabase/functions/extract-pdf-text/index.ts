console.log("⚡️ PDF Extraction Function initializing…");

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("✅ Basic imports loaded successfully");

// Primary: PDF.js via CDN for robust text extraction (loaded dynamically)
let pdfjs: any = null;
let pdfJsAvailable = false;

// Dynamic PDF.js loader - called on first use to avoid startup delays
async function loadPDFJS(): Promise<boolean> {
  if (pdfjs !== null) {
    return pdfJsAvailable; // Already tried loading
  }
  
  try {
    console.log("🔄 Loading PDF.js CDN dynamically...");
    // Import PDF.js from jsDelivr CDN
    const { getDocument, GlobalWorkerOptions } = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@5.3.93/es5/build/pdf.js");
    
    // Set up the worker for PDF.js
    GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.3.93/es5/build/pdf.worker.js";
    
    pdfjs = { getDocument };
    pdfJsAvailable = true;
    console.log("✅ PDF.js CDN loaded successfully");
    return true;
  } catch (error) {
    console.warn("⚠️ PDF.js CDN failed to load, will use ASCII fallback:", error.message);
    pdfjs = null;
    pdfJsAvailable = false;
    return false;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Primary: PDF.js text extraction with full fidelity
async function extractTextWithPDFJS(buffer: ArrayBuffer): Promise<string> {
  console.log('🔍 Starting PDF.js text extraction...')
  const startTime = Date.now()
  
  try {
    const data = new Uint8Array(buffer)
    console.log(`Loading PDF document... (${data.length} bytes)`)
    
    const loadingTask = pdfjs.getDocument({ data })
    const pdf = await loadingTask.promise
    
    const totalPages = pdf.numPages
    const maxPages = Math.min(10, totalPages) // Limit to 10 pages for performance
    
    console.log(`PDF loaded: ${totalPages} pages, processing first ${maxPages}`)
    
    let fullText = ""
    
    for (let i = 1; i <= maxPages; i++) {
      try {
        console.log(`Processing page ${i}/${maxPages}...`)
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        
        // Extract text from page items with proper spacing
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ")
          .trim()
        
        if (pageText) {
          fullText += pageText + "\n\n"
          console.log(`Page ${i}: extracted ${pageText.length} characters`)
        } else {
          console.log(`Page ${i}: no text found`)
        }
      } catch (pageError) {
        console.warn(`Error processing page ${i}:`, pageError.message)
        // Continue with other pages
      }
    }
    
    // Clean up PDF document
    if (pdf.destroy) {
      await pdf.destroy()
    }
    
    const extractionTime = Date.now() - startTime
    console.log('✅ PDF.js extraction completed:', {
      totalPages,
      pagesProcessed: maxPages,
      charactersExtracted: fullText.length,
      extractionTimeMs: extractionTime
    })
    
    return fullText.trim()
  } catch (error) {
    console.error('❌ PDF.js extraction failed:', error)
    throw new Error(`PDF.js extraction failed: ${error.message}`)
  }
}

// Fallback: ASCII-based PDF text extraction (guaranteed to work)
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

// Master extraction function with intelligent fallback
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<{ text: string, method: string }> {
  const MAX_CHARS = 100000
  let extractedText = ""
  let method = "unknown"
  
  // Try to load PDF.js dynamically and use it
  const pdfJsLoaded = await loadPDFJS()
  if (pdfJsLoaded) {
    try {
      extractedText = await extractTextWithPDFJS(buffer)
      method = "pdfjs-cdn"
      console.log(`✅ Used PDF.js CDN extraction: ${extractedText.length} chars`)
    } catch (pdfJsError) {
      console.warn("⚠️ PDF.js extraction failed, falling back to ASCII:", pdfJsError.message)
      // Fall through to ASCII method
    }
  } else {
    console.log("📝 PDF.js dynamic loading failed, using ASCII fallback")
  }
  
  // Use ASCII fallback if PDF.js failed or unavailable
  if (!extractedText) {
    try {
      extractedText = extractTextWithASCII(buffer)
      method = "ascii-fallback"
      console.log(`✅ Used ASCII fallback extraction: ${extractedText.length} chars`)
    } catch (asciiError) {
      console.error("❌ Both extraction methods failed:", asciiError.message)
      throw new Error(`All text extraction methods failed: ${asciiError.message}`)
    }
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
    
    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the document ID from request
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
      console.log('Fetching PDF from storage URL:', document.storage_url);
      
      // Fetch PDF directly from storage URL
      const response = await fetch(document.storage_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
      }

      // Get PDF as ArrayBuffer
      const pdfBuffer = await response.arrayBuffer()
      console.log(`PDF downloaded: ${pdfBuffer.byteLength} bytes`)
      
      // Extract text using intelligent method selection with fallback
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
          method: method,
          pdfJsAvailable: pdfJsAvailable,
          loadedDynamically: pdfjs !== null
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