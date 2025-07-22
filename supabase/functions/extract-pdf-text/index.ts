
console.log("⚡️ PDF Extraction Function initializing…");

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("✅ Basic imports loaded successfully");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Enhanced PDF text extraction using multiple methods
async function extractTextFromPDF(pdfBuffer: Uint8Array): Promise<string> {
  console.log("Starting PDF text extraction with enhanced method");
  
  try {
    // Convert buffer to string for text extraction
    const pdfString = new TextDecoder('latin1').decode(pdfBuffer);
    
    // Enhanced extraction patterns for PDF text objects
    const patterns = [
      // Standard PDF text objects with various operators
      /\(([^)]{3,})\)\s*Tj/g,
      /\(([^)]{3,})\)\s*TJ/g,
      /\[\(([^)]{3,})\)\]\s*TJ/g,
      // Text between BT and ET operators (text blocks)
      /BT\s+[^(]*\(([^)]{3,})\)[^E]*ET/gs,
      // Font and text combinations
      /\/F\d+\s+\d+\s+Tf[^(]*\(([^)]{3,})\)/g,
      // Multi-line text patterns
      /Td\s*\(([^)]{5,})\)\s*Tj/g,
      // Text with positioning
      /\d+\s+\d+\s+Td\s*\(([^)]{3,})\)/g,
    ];
    
    const extractedTexts = new Set<string>();
    let totalMatches = 0;
    
    // Apply each pattern to extract text
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null && totalMatches < 10000) {
        const text = match[1];
        if (text && text.length > 2) {
          // Clean up the extracted text
          const cleanText = text
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
            .trim();
          
          if (cleanText.length > 2 && /[a-zA-Z]/.test(cleanText)) {
            extractedTexts.add(cleanText);
            totalMatches++;
          }
        }
      }
      // Reset regex lastIndex for next iteration
      pattern.lastIndex = 0;
    }
    
    console.log(`Extracted ${extractedTexts.size} unique text segments from ${totalMatches} matches`);
    
    // Convert set to array and join
    const extractedArray = Array.from(extractedTexts);
    
    // If we got substantial structured text, use it
    if (extractedArray.length > 20) {
      const result = extractedArray.join('\n');
      console.log(`Using structured extraction: ${result.length} characters`);
      return result.substring(0, 100000); // Increased limit
    }
    
    // Fallback: extract readable lines from the PDF stream
    console.log("Falling back to line-based extraction");
    const lines = pdfString.split(/[\r\n]+/);
    const readableLines: string[] = [];
    
    for (const line of lines) {
      // Look for lines with substantial readable content
      const cleanLine = line
        .replace(/[^\x20-\x7E]/g, ' ') // Replace non-printable with spaces
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      
      // Include lines that have substantial text content
      if (cleanLine.length > 15 && 
          cleanLine.match(/[a-zA-Z]{3,}/) && 
          (cleanLine.includes(' ') || cleanLine.length > 30)) {
        readableLines.push(cleanLine);
      }
    }
    
    const fallbackResult = readableLines.slice(0, 2000).join('\n');
    console.log(`Fallback extraction: ${fallbackResult.length} characters from ${readableLines.length} lines`);
    
    return fallbackResult.substring(0, 100000);
    
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse PDF content: ${error.message}`);
  }
}

// Enhanced text quality validation with more lenient thresholds
function validateTextQuality(text: string): { isValid: boolean; quality: number; reason?: string } {
  if (!text || text.length < 50) {
    return { isValid: false, quality: 0, reason: 'Text too short' };
  }
  
  // Count various text quality metrics
  const totalChars = text.length;
  const letters = text.match(/[a-zA-Z]/g)?.length || 0;
  const words = text.match(/\b[a-zA-Z]{2,}\b/g)?.length || 0;
  const sentences = text.match(/[.!?]+/g)?.length || 0;
  const numbers = text.match(/\d/g)?.length || 0;
  
  // Calculate quality score
  const letterRatio = letters / totalChars;
  const wordDensity = words / (totalChars / 100); // words per 100 chars
  const hasStructure = sentences > 0 && words > sentences * 3;
  
  let quality = 0;
  quality += letterRatio * 40; // Up to 40 points for letter content
  quality += Math.min(wordDensity * 2, 30); // Up to 30 points for word density
  quality += hasStructure ? 20 : 0; // 20 points for sentence structure
  quality += Math.min((numbers / totalChars) * 100, 10); // Up to 10 points for numbers
  
  quality = Math.round(quality);
  
  // More lenient validation - lowered from 60% to 40%
  if (letterRatio < 0.3) {
    return { isValid: false, quality, reason: 'Too few alphabetic characters' };
  }
  
  if (words < 20) {
    return { isValid: false, quality, reason: 'Too few words detected' };
  }
  
  if (quality < 40) {
    return { isValid: false, quality, reason: 'Overall quality score too low' };
  }
  
  return { isValid: true, quality };
}

// Extract and validate text with enhanced error handling
async function extractAndValidateText(buffer: ArrayBuffer): Promise<{ text: string, quality: number, method: string }> {
  const MAX_CHARS = 100000; // Increased from 50k
  
  try {
    console.log(`Processing PDF buffer of ${buffer.byteLength} bytes`);
    
    const pdfBuffer = new Uint8Array(buffer);
    const extractedText = await extractTextFromPDF(pdfBuffer);
    
    console.log(`Raw extraction completed: ${extractedText.length} characters`);
    
    // Validate text quality with more lenient thresholds
    const validation = validateTextQuality(extractedText);
    console.log(`Text validation - Quality: ${validation.quality}%, Valid: ${validation.isValid}`);
    
    if (!validation.isValid) {
      // Log first 500 chars for debugging
      console.log('Sample of extracted text:', extractedText.substring(0, 500));
      throw new Error(`PDF text extraction validation failed: ${validation.reason}. Quality score: ${validation.quality}%`);
    }
    
    // Apply character limit
    let finalText = extractedText;
    if (finalText.length > MAX_CHARS) {
      finalText = finalText.slice(0, MAX_CHARS) + '\n\n[Content truncated at 100k character limit]';
    }
    
    console.log(`✅ Text extracted and validated: ${finalText.length} chars (quality: ${validation.quality}%)`);
    
    return { 
      text: finalText, 
      quality: validation.quality, 
      method: 'enhanced-pdf-parsing-v2' 
    };
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
    
    // Parse request body
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

    // Health check endpoint
    if (documentId === 'health-check') {
      console.log("🔍 Running health check...");
      return new Response(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          extractionMethod: 'enhanced-pdf-parsing-v2',
          description: "PDF extraction service is running with enhanced parsing"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client
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
      
      // Extract file path from storage URL
      const urlParts = document.storage_url.split('/');
      const pathIndex = urlParts.indexOf('documents');
      if (pathIndex === -1 || pathIndex + 2 >= urlParts.length) {
        throw new Error('Invalid storage URL format');
      }
      const filePath = urlParts.slice(pathIndex + 1).join('/');
      console.log('Extracted file path:', filePath);
      
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('documents')
        .download(filePath);
      
      if (downloadError || !fileData) {
        console.error('Storage download error:', downloadError);
        throw new Error(`Failed to download PDF from storage: ${downloadError?.message || 'No file data'}`);
      }

      // Convert to ArrayBuffer for processing
      const pdfBuffer = await fileData.arrayBuffer();
      console.log(`PDF downloaded successfully: ${pdfBuffer.byteLength} bytes`)
      
      // Extract and validate text using enhanced method
      const { text: extractedText, quality, method } = await extractAndValidateText(pdfBuffer);
      
      console.log(`✅ Extraction complete: ${extractedText.length} characters using ${method} (quality: ${quality}%)`);
      
      // Log first 200 characters for debugging
      console.log('Text preview:', extractedText.substring(0, 200) + '...');

      // Smart chunking for AI context
      const chunks = chunkText(extractedText, 15000, 500); // Increased chunk size
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
          method: method,
          preview: extractedText.substring(0, 200) + '...'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )

    } catch (extractionError) {
      console.error('❌ Text extraction error:', extractionError)
      
      const errorMessage = extractionError instanceof Error 
        ? extractionError.message 
        : 'Failed to extract text from PDF';
      
      // Update document status to error
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
    console.error('❌ Unexpected error:', error)
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
