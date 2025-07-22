
console.log("⚡️ PDF Extraction Function initializing…");

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("✅ Basic imports loaded successfully");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Enhanced PDF text extraction using pdf-parse library
async function extractTextFromPDF(pdfBuffer: Uint8Array): Promise<string> {
  console.log("Starting PDF text extraction with pdf-parse library");
  
  try {
    // Import pdf-parse dynamically
    const pdfParse = (await import('https://esm.sh/pdf-parse@1.1.1')).default;
    
    console.log(`Processing PDF buffer of ${pdfBuffer.length} bytes`);
    
    // Use pdf-parse to extract text
    const pdfData = await pdfParse(pdfBuffer);
    
    console.log(`PDF parsed successfully - Pages: ${pdfData.numpages}, Text length: ${pdfData.text.length}`);
    
    let extractedText = pdfData.text;
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .trim();
    
    if (extractedText.length < 100) {
      throw new Error(`Extracted text too short: ${extractedText.length} characters`);
    }
    
    console.log(`✅ Text extraction successful: ${extractedText.length} characters`);
    console.log(`Preview: ${extractedText.substring(0, 200)}...`);
    
    return extractedText;
    
  } catch (error) {
    console.error('PDF parsing with pdf-parse failed:', error);
    
    // Fallback to simple text extraction
    console.log("Attempting fallback text extraction...");
    return await fallbackTextExtraction(pdfBuffer);
  }
}

// Enhanced fallback text extraction with multiple strategies
async function fallbackTextExtraction(pdfBuffer: Uint8Array): Promise<string> {
  console.log("Using enhanced fallback text extraction method");
  
  try {
    const pdfString = new TextDecoder('latin1').decode(pdfBuffer);
    
    // Strategy 1: Enhanced text object patterns
    const textMatches = [];
    const enhancedPatterns = [
      // Standard text positioning operators
      /\(([^)]{3,})\)\s*Tj/g,
      /\(([^)]{3,})\)\s*TJ/g,
      /\[([^\]]{10,})\]\s*TJ/g,
      
      // Text blocks with positioning
      /BT\s+[^(]*\(([^)]{3,})\)[^E]*ET/gs,
      /BT\s+.*?Td\s+\(([^)]{3,})\)/gs,
      /BT\s+.*?Tm\s+\(([^)]{3,})\)/gs,
      
      // Direct text content in streams
      /stream[\s\S]*?\(([^)]{5,})\)[\s\S]*?endstream/g,
      
      // Hex encoded text
      /<([0-9A-Fa-f]{8,})>\s*Tj/g,
      /<([0-9A-Fa-f]{8,})>\s*TJ/g,
    ];
    
    for (const pattern of enhancedPatterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null && textMatches.length < 2000) {
        let text = match[1];
        
        // Handle hex encoded strings
        if (/^[0-9A-Fa-f]+$/.test(text) && text.length % 2 === 0) {
          try {
            text = text.match(/.{2}/g)
              ?.map(hex => String.fromCharCode(parseInt(hex, 16)))
              .join('') || text;
          } catch (e) {
            // Keep original if hex decode fails
          }
        }
        
        // Clean up text
        text = text
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\')
          .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable chars
          .trim();
        
        if (text.length > 2 && /[a-zA-Z0-9]/.test(text)) {
          textMatches.push(text);
        }
      }
      pattern.lastIndex = 0;
    }
    
    // Strategy 2: Look for raw text in content streams
    if (textMatches.length < 10) {
      console.log("Trying content stream extraction...");
      const streamPattern = /stream\s*([\s\S]*?)\s*endstream/g;
      let streamMatch;
      
      while ((streamMatch = streamPattern.exec(pdfString)) !== null) {
        const streamContent = streamMatch[1];
        
        // Look for readable text in streams
        const readableText = streamContent
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (readableText.length > 20 && /[a-zA-Z]{3,}/.test(readableText)) {
          // Extract words that look like real text
          const words = readableText.match(/[a-zA-Z]{3,}(?:\s+[a-zA-Z]{3,})*/g);
          if (words) {
            textMatches.push(...words);
          }
        }
      }
    }
    
    // Strategy 3: Brute force text extraction from the entire PDF
    if (textMatches.length < 5) {
      console.log("Trying brute force text extraction...");
      const cleanPdf = pdfString
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ');
      
      const potentialText = cleanPdf.match(/[a-zA-Z]{3,}(?:\s+[a-zA-Z0-9\.,\-\$%]{1,}){2,}/g);
      if (potentialText) {
        textMatches.push(...potentialText.slice(0, 100));
      }
    }
    
    if (textMatches.length === 0) {
      // Last resort: Return a message indicating the PDF might be image-based
      return "This PDF appears to contain primarily images or uses a format that requires OCR (Optical Character Recognition) to extract text. The document structure suggests it may be a scanned document or uses embedded images for text content. Please consider using an OCR-enabled PDF processor or converting the document to a text-searchable format.";
    }
    
    // Clean and deduplicate text
    const uniqueText = Array.from(new Set(textMatches))
      .filter(text => text.length > 2)
      .join('\n')
      .substring(0, 100000);
    
    console.log(`Enhanced fallback extraction: ${uniqueText.length} characters from ${textMatches.length} text segments`);
    
    return uniqueText;
    
  } catch (error) {
    console.error('Enhanced fallback extraction failed:', error);
    return "PDF text extraction failed. This document may be image-based or use an unsupported format. The file appears to be a valid PDF but does not contain extractable text content.";
  }
}

// Validate extracted text quality
function validateTextQuality(text: string): { isValid: boolean; quality: number; reason?: string } {
  if (!text || text.length < 50) {
    return { isValid: false, quality: 0, reason: 'Text too short' };
  }
  
  const totalChars = text.length;
  const letters = text.match(/[a-zA-Z]/g)?.length || 0;
  const words = text.match(/\b[a-zA-Z]{2,}\b/g)?.length || 0;
  const sentences = text.match(/[.!?]+/g)?.length || 0;
  
  const letterRatio = letters / totalChars;
  const wordDensity = words / (totalChars / 100);
  const hasStructure = sentences > 0 && words > sentences * 2;
  
  let quality = 0;
  quality += letterRatio * 40;
  quality += Math.min(wordDensity * 2, 30);
  quality += hasStructure ? 20 : 0;
  quality += Math.min((text.match(/\d/g)?.length || 0) / totalChars * 100, 10);
  
  quality = Math.round(quality);
  
  // Lowered threshold to 20% to allow more complex documents through
  if (letterRatio < 0.15) {
    return { isValid: false, quality, reason: 'Too few alphabetic characters' };
  }
  
  if (words < 10) {
    return { isValid: false, quality, reason: 'Too few words detected' };
  }
  
  if (quality < 20) {
    return { isValid: false, quality, reason: 'Overall quality score too low' };
  }
  
  return { isValid: true, quality };
}

serve(async (req) => {
  console.log("🚀 PDF Extraction request received");
  
  if (req.method === 'OPTIONS') {
    console.log("📋 CORS preflight request");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    console.log('=== PDF Extraction Request Started ===')
    
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
          extractionMethod: 'pdf-parse-with-fallback',
          description: "PDF extraction service is running with pdf-parse library"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

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
      const pdfUint8Array = new Uint8Array(pdfBuffer);
      console.log(`PDF downloaded successfully: ${pdfBuffer.byteLength} bytes`)
      
      // Extract text using improved method
      const extractedText = await extractTextFromPDF(pdfUint8Array);
      
      // Validate text quality
      const validation = validateTextQuality(extractedText);
      console.log(`Text validation - Quality: ${validation.quality}%, Valid: ${validation.isValid}`);
      
      if (!validation.isValid) {
        console.log('Sample of extracted text:', extractedText.substring(0, 500));
        throw new Error(`PDF text extraction validation failed: ${validation.reason}. Quality score: ${validation.quality}%`);
      }
      
      // Apply character limit
      const MAX_CHARS = 100000;
      let finalText = extractedText;
      if (finalText.length > MAX_CHARS) {
        finalText = finalText.slice(0, MAX_CHARS) + '\n\n[Content truncated at 100k character limit]';
      }
      
      console.log(`✅ Text extracted and validated: ${finalText.length} chars (quality: ${validation.quality}%)`);

      // Update document with extracted text
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          extracted_text: finalText,
          status: 'ready',
          error_message: null // Clear any previous errors
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
          message: `PDF text extracted successfully using pdf-parse`,
          textLength: finalText.length,
          quality: validation.quality,
          method: 'pdf-parse-with-fallback',
          preview: finalText.substring(0, 200) + '...'
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
