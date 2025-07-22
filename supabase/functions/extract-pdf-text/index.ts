console.log("⚡️ PDF Extraction Function initializing…");

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("✅ Basic imports loaded successfully");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Enhanced PDF text extraction function
function extractTextFromPDF(pdfBuffer: Uint8Array): string {
  try {
    // Convert buffer to string and look for text content
    const pdfString = new TextDecoder('latin1').decode(pdfBuffer);
    
    // Enhanced PDF text extraction patterns
    const patterns = [
      // Standard PDF text objects: (text) Tj
      /\(([^)]+)\)\s*Tj/g,
      // Array text objects: [(text)] TJ
      /\[\(([^)]+)\)\]\s*TJ/g,
      // Text within parentheses
      /\(([^)]+)\)/g,
      // Text between BT and ET operators
      /BT\s+.*?\s+\(([^)]+)\)\s*.*?ET/gs,
      // Simple text extraction for headers/titles
      /\/F\d+\s+\d+\s+Tf[^(]*\(([^)]+)\)/g,
    ];
    
    const extractedLines: string[] = [];
    
    // Apply each pattern to extract text
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null) {
        const text = match[1];
        if (text && text.length > 1) {
          // Clean up the extracted text
          const cleanText = text
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .trim();
          
          if (cleanText.length > 2 && !extractedLines.includes(cleanText)) {
            extractedLines.push(cleanText);
          }
        }
      }
    }
    
    // If we found structured text, use it
    if (extractedLines.length > 10) {
      return extractedLines.join('\n').substring(0, 50000); // Limit size
    }
    
    // Fallback: Look for readable ASCII content in the PDF
    const lines = pdfString.split(/[\r\n]+/);
    const readableLines: string[] = [];
    
    for (const line of lines) {
      // Filter for lines that contain readable text (letters, numbers, common punctuation)
      const readable = line.match(/[a-zA-Z0-9\s.,;:!?\-$%()]+/g);
      if (readable) {
        const cleanLine = readable.join(' ').trim();
        // Only include lines with substantial readable content
        if (cleanLine.length > 10 && cleanLine.match(/[a-zA-Z]{3,}/)) {
          readableLines.push(cleanLine);
        }
      }
    }
    
    return readableLines.slice(0, 500).join('\n').substring(0, 50000);
    
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF content');
  }
}

// Validate extracted text quality
function validateTextQuality(text: string): { isValid: boolean; quality: number; reason?: string } {
  if (!text || text.length < 100) {
    return { isValid: false, quality: 0, reason: 'Text too short' };
  }
  
  // Count readable characters vs total characters
  const readableChars = text.match(/[a-zA-Z0-9\s.,;:!?\-$%()]/g)?.length || 0;
  const totalChars = text.length;
  const readabilityRatio = readableChars / totalChars;
  
  // Count words
  const words = text.match(/\b[a-zA-Z]{2,}\b/g)?.length || 0;
  
  // Calculate quality score
  const quality = Math.min(100, Math.round(readabilityRatio * 70 + (words / text.length) * 300));
  
  if (readabilityRatio < 0.6) {
    return { isValid: false, quality, reason: 'Low readability ratio' };
  }
  
  if (words < 50) {
    return { isValid: false, quality, reason: 'Too few words detected' };
  }
  
  return { isValid: true, quality };
}

// Extract and validate text from PDF
async function extractAndValidateText(buffer: ArrayBuffer): Promise<{ text: string, quality: number, method: string }> {
  const MAX_CHARS = 50000;
  
  try {
    // Convert ArrayBuffer to Uint8Array for processing
    const pdfBuffer = new Uint8Array(buffer);
    const extractedText = extractTextFromPDF(pdfBuffer);
    
    // Validate text quality
    const validation = validateTextQuality(extractedText);
    
    if (!validation.isValid) {
      throw new Error(`PDF text extraction failed: ${validation.reason}. Quality score: ${validation.quality}%`);
    }
    
    // Apply character limit
    let finalText = extractedText;
    if (finalText.length > MAX_CHARS) {
      finalText = finalText.slice(0, MAX_CHARS) + '\n\n[Content truncated at 50k character limit]';
    }
    
    console.log(`✅ Text extracted and validated: ${finalText.length} chars (quality: ${validation.quality}%)`);
    
    return { text: finalText, quality: validation.quality, method: 'enhanced-pdf-parsing' };
  } catch (error) {
    console.error("❌ Enhanced extraction failed:", error.message);
    throw error;
  }
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
      
      // Extract and validate text using enhanced method
      const { text: extractedText, quality, method } = await extractAndValidateText(pdfBuffer);
      
      console.log(`Final extracted text: ${extractedText.length} characters using ${method} (quality: ${quality}%)`);

      // Implement smart chunking for AI context (12000 tokens with 500 overlap)
      const chunks = chunkText(extractedText, 12000, 500);
      console.log(`Text chunked into ${chunks.length} segments`);

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
          quality: quality,
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