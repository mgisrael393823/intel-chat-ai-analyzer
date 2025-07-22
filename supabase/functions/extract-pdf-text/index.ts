console.log("⚡️ PDF Extraction Function initializing…");

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("✅ Basic imports loaded successfully");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

// Robust PDF text extraction with multiple strategies
async function extractTextFromPDF(pdfBuffer: Uint8Array): Promise<string> {
  console.log("Starting comprehensive PDF text extraction");
  
  try {
    // Convert buffer to text for processing
    const pdfString = new TextDecoder('latin1').decode(pdfBuffer);
    console.log(`PDF string length: ${pdfString.length} characters`);
    
    // Strategy 1: Extract text from text objects with improved patterns
    const textMatches: string[] = [];
    
    // Enhanced text extraction patterns
    const patterns = [
      // Standard text operators - more comprehensive
      /\(([^)]{2,})\)\s*Tj/g,
      /\(([^)]{2,})\)\s*TJ/g,
      /\[([^\]]{5,})\]\s*TJ/g,
      
      // Text with positioning - extract readable content
      /BT\s+.*?\(([^)]{3,})\).*?ET/gs,
      /Td\s+\(([^)]{3,})\)/g,
      /Tm\s+\(([^)]{3,})\)/g,
      
      // Direct content extraction from streams
      /stream\s*\n([\s\S]*?)\nendstream/g,
      
      // Hex-encoded text patterns
      /<([0-9A-Fa-f]{8,})>\s*[TtJj]/g,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(pdfString)) !== null && textMatches.length < 1000) {
        let text = match[1];
        
        // Handle hex-encoded text
        if (/^[0-9A-Fa-f]+$/.test(text) && text.length % 2 === 0) {
          try {
            text = text.match(/.{2}/g)
              ?.map(hex => String.fromCharCode(parseInt(hex, 16)))
              .join('') || text;
          } catch {
            continue; // Skip invalid hex
          }
        }
        
        // Clean and validate text
        text = text
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\')
          .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .trim();
        
        // Only keep text that looks like real content
        if (text.length > 2 && /[a-zA-Z]/.test(text) && !/^[\s\d\.\-\+\*\/\=\(\)\[\]<>{}]+$/.test(text)) {
          textMatches.push(text);
        }
      }
      pattern.lastIndex = 0;
    }
    
    console.log(`Extracted ${textMatches.length} text segments from patterns`);
    
    // Strategy 2: Content stream analysis for readable text
    if (textMatches.length < 20) {
      console.log("Analyzing content streams for readable text...");
      
      const streamMatches = pdfString.matchAll(/stream\s*\n([\s\S]*?)\nendstream/g);
      for (const streamMatch of streamMatches) {
        const streamContent = streamMatch[1];
        
        // Look for sequences of readable characters
        const readableSequences = streamContent.match(/[a-zA-Z][a-zA-Z0-9\s\.\,\;\:\!\?\-]{10,}/g);
        if (readableSequences) {
          textMatches.push(...readableSequences.slice(0, 50));
        }
      }
    }
    
    // Strategy 3: Direct text search in PDF structure
    if (textMatches.length < 10) {
      console.log("Searching for direct text content...");
      
      // Find text that appears to be readable content
      const directTextMatches = pdfString.match(/[A-Z][a-z]{2,}(?:\s+[a-zA-Z0-9\.\,\-\$\%]{1,}){3,}/g);
      if (directTextMatches) {
        textMatches.push(...directTextMatches.slice(0, 100));
      }
    }
    
    // Clean up and deduplicate
    const uniqueTexts = Array.from(new Set(textMatches))
      .filter(text => text.length > 3 && /[a-zA-Z]{2,}/.test(text))
      .map(text => text.replace(/\s+/g, ' ').trim());
    
    if (uniqueTexts.length === 0) {
      throw new Error("No readable text found in PDF");
    }
    
    // Join all text with proper spacing
    const extractedText = uniqueTexts.join('\n').substring(0, 100000);
    
    console.log(`✅ Successfully extracted ${extractedText.length} characters of text`);
    console.log(`Preview: ${extractedText.substring(0, 300)}...`);
    
    return extractedText;
    
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
}

// Enhanced text quality validation
function validateExtractedText(text: string): { isValid: boolean; quality: number; reason?: string } {
  if (!text || text.length < 50) {
    return { isValid: false, quality: 0, reason: 'Text too short' };
  }
  
  // Check for binary data indicators
  if (text.includes('<<') && text.includes('>>') && text.includes('/')) {
    return { isValid: false, quality: 0, reason: 'Binary data detected' };
  }
  
  const totalChars = text.length;
  const letters = text.match(/[a-zA-Z]/g)?.length || 0;
  const words = text.match(/\b[a-zA-Z]{2,}\b/g)?.length || 0;
  const sentences = text.match(/[.!?]+/g)?.length || 0;
  
  const letterRatio = letters / totalChars;
  const wordDensity = words / (totalChars / 100);
  
  let quality = 0;
  quality += letterRatio * 50;
  quality += Math.min(wordDensity * 3, 30);
  quality += sentences > 0 ? 20 : 0;
  
  quality = Math.round(quality);
  
  // Lower thresholds but ensure we have real content
  if (letterRatio < 0.1) {
    return { isValid: false, quality, reason: 'Too few letters' };
  }
  
  if (words < 5) {
    return { isValid: false, quality, reason: 'Too few words' };
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
    
    const requestBody = await req.json();
    const { documentId } = requestBody;
    console.log('Request payload received:', { documentId });

    // Health check
    if (documentId === 'health-check') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          extractionMethod: 'enhanced-text-extraction'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Document ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get document record
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update status to processing
    await supabaseClient
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

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
        throw new Error(`Failed to download PDF: ${downloadError?.message || 'No file data'}`);
      }

      // Convert to ArrayBuffer for processing
      const pdfBuffer = await fileData.arrayBuffer();
      const pdfUint8Array = new Uint8Array(pdfBuffer);
      console.log(`PDF downloaded successfully: ${pdfBuffer.byteLength} bytes`);
      
      // Extract text using enhanced method
      const extractedText = await extractTextFromPDF(pdfUint8Array);
      
      // Validate extracted text
      const validation = validateExtractedText(extractedText);
      console.log(`Text validation - Quality: ${validation.quality}%, Valid: ${validation.isValid}`);
      
      if (!validation.isValid) {
        throw new Error(`Text extraction validation failed: ${validation.reason}. Quality: ${validation.quality}%`);
      }
      
      console.log(`✅ Text extracted successfully: ${extractedText.length} chars (quality: ${validation.quality}%)`);

      // Update document with extracted text
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          extracted_text: extractedText,
          status: 'ready',
          error_message: null
        })
        .eq('id', documentId);

      if (updateError) {
        console.error('Failed to update document:', updateError);
        throw new Error('Failed to update document with extracted text');
      }

      console.log('✅ PDF extraction completed successfully');
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'PDF text extracted successfully',
          textLength: extractedText.length,
          quality: validation.quality,
          preview: extractedText.substring(0, 200) + '...'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (extractionError) {
      console.error('❌ Text extraction error:', extractionError);
      
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
        .eq('id', documentId);

      return new Response(
        JSON.stringify({
          error: 'Failed to extract text from PDF',
          details: errorMessage
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

console.log("✅ PDF Extraction function ready to serve");
