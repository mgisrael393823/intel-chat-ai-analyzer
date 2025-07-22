console.log("⚡️ PDF Extraction Function initializing…");

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log("✅ Basic imports loaded successfully");

// Primary: PDF.js via CDN for robust text extraction (loaded dynamically)
let pdfjs: any = null;
let pdfJsAvailable = false;

// Dynamic PDF.js loader - using legacy build for Edge Runtime compatibility
async function loadPDFJS(): Promise<boolean> {
  if (pdfjs !== null) {
    return pdfJsAvailable; // Already tried loading
  }
  
  try {
    console.log("🔄 Loading PDF.js legacy build...");
    // Use legacy build designed for environments without DOM/worker support
    const pdfModule = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.js");
    
    // Handle different export patterns for legacy build
    const getDocument = pdfModule.getDocument || pdfModule.default?.getDocument || pdfModule;
    if (!getDocument || typeof getDocument !== 'function') {
      throw new Error("getDocument not found in PDF.js legacy module");
    }
    
    // NO worker configuration needed for legacy build - it's designed to run without workers
    pdfjs = { getDocument };
    pdfJsAvailable = true;
    console.log("✅ PDF.js legacy build loaded successfully (no worker required)");
    return true;
  } catch (legacyError) {
    console.warn("⚠️ PDF.js legacy build failed, trying regular build with no-worker:", legacyError.message);
    
    // Fallback: try regular build but completely bypass worker setup
    try {
      console.log("🔄 Trying regular PDF.js build with worker bypass...");
      const pdfModule = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.js");
      
      const getDocument = pdfModule.getDocument || pdfModule.default?.getDocument;
      if (!getDocument) {
        throw new Error("getDocument not found in regular PDF.js module");
      }
      
      // Store reference without any worker setup
      pdfjs = { getDocument };
      pdfJsAvailable = true;
      console.log("✅ PDF.js regular build loaded (worker setup skipped)");
      return true;
    } catch (regularError) {
      console.error("⚠️ Both legacy and regular PDF.js builds failed:", regularError.message);
      pdfjs = null;
      pdfJsAvailable = false;
      return false;
    }
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
    
    // Configure PDF.js for Edge Runtime compatibility
    const loadingTask = pdfjs.getDocument({
      data,
      disableWorker: true,        // Force main-thread processing (no DOM required)
      standardFontDataUrl: false, // No external font fetches
      disableFontFace: true       // Skip custom fonts
    })
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

    // Health check endpoint with comprehensive PDF.js testing
    if (documentId === 'health-check') {
      console.log("🔍 Running comprehensive health check...");
      const startTime = Date.now();
      
      const pdfJsLoaded = await loadPDFJS();
      
      let testResult = null;
      if (pdfJsLoaded) {
        try {
          // Create minimal test PDF
          const testPdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 44>>stream
BT/Helvetica 12 Tf 72 720 Td(Test)Tj ET
endstream endobj
xref 0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000251 00000 n 
trailer<</Size 5/Root 1 0 R>>startxref 320%%EOF`;
          
          const testBuffer = new TextEncoder().encode(testPdfContent);
          console.log(`Testing PDF.js with ${testBuffer.length} byte test PDF`);
          
          // Use same Edge Runtime compatible configuration
          const loadingTask = pdfjs.getDocument({
            data: testBuffer,
            disableWorker: true,        // Force main-thread processing
            standardFontDataUrl: false, // No external font fetches  
            disableFontFace: true       // Skip custom fonts
          });
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const textContent = await page.getTextContent();
          const extractedText = textContent.items.map((item: any) => item.str).join(" ");
          
          // Clean up
          if (pdf.destroy) await pdf.destroy();
          
          testResult = {
            success: true,
            extractedText: extractedText.trim(),
            testTimeMs: Date.now() - startTime
          };
          console.log("✅ PDF.js test extraction successful");
        } catch (testError) {
          testResult = {
            success: false,
            error: testError.message,
            testTimeMs: Date.now() - startTime
          };
          console.error("❌ PDF.js test extraction failed:", testError);
        }
      }
      
      return new Response(
        JSON.stringify({ 
          status: 'healthy',
          timestamp: new Date().toISOString(),
          pdfJs: {
            available: pdfJsLoaded,
            test: testResult
          },
          asciiParser: {
            available: true,
            description: "Fallback ASCII extraction always available"
          },
          totalHealthCheckTime: Date.now() - startTime
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

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