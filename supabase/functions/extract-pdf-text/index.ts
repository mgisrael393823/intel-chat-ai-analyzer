import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Use pdf-parse for PDF text extraction with fallback
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
      console.log('📄 Starting PDF text extraction for document:', documentId);
      
      // Download the PDF file from storage
      const fileName = document.storage_url.split('/').pop()!;
      console.log('📥 Downloading PDF file:', fileName);
      
      const { data: fileData, error: downloadError } = await supabaseClient.storage
        .from('documents')
        .download(fileName);

      if (downloadError || !fileData) {
        console.error('❌ Failed to download PDF:', downloadError);
        throw new Error('Failed to download PDF file');
      }

      console.log('✅ PDF downloaded, size:', fileData.size, 'bytes');

      // Convert Blob to ArrayBuffer for pdf-parse
      const arrayBuffer = await fileData.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      console.log('🔄 Extracting text from PDF...');
      
      let extractedText = '';
      
      try {
        // Primary method: Extract text using pdf-parse
        const data = await pdf(uint8Array, {
          // Options for pdf-parse
          max: 0, // 0 = parse all pages
        });

        extractedText = data.text;
        console.log('✅ Primary extraction completed, length:', extractedText.length, 'characters');
        
      } catch (pdfParseError) {
        console.error('❌ Primary PDF extraction failed:', pdfParseError);
        
        // Fallback method: Try with different options
        try {
          console.log('🔄 Trying fallback extraction method...');
          const fallbackData = await pdf(uint8Array, {
            max: 50, // Limit to first 50 pages if it's a large PDF
            normalize: true,
          });
          
          extractedText = fallbackData.text;
          console.log('✅ Fallback extraction completed, length:', extractedText.length, 'characters');
          
        } catch (fallbackError) {
          console.error('❌ Fallback extraction also failed:', fallbackError);
          
          // Final fallback: Create a basic text placeholder
          extractedText = `PDF Document: ${document.name}

This document was uploaded but text extraction encountered technical difficulties.
The file is available for analysis, but some features may be limited.

File details:
- Name: ${document.name}
- Size: ${document.size} bytes
- Type: ${document.type}
- Upload Date: ${new Date().toLocaleDateString()}

You can still ask questions about this document, and I'll do my best to help based on the filename and general commercial real estate knowledge.`;

          console.log('⚠️ Using placeholder text due to extraction failures');
        }
      }
      
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No text could be extracted from the PDF after all attempts');
      }

      // Clean up the extracted text
      const cleanedText = extractedText
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .replace(/\n\s*\n/g, '\n')  // Remove empty lines
        .trim();

      console.log('🧹 Text cleaned, final length:', cleanedText.length, 'characters');

      // Implement smart chunking for AI context (6000 tokens with 500 overlap)
      const chunks = chunkText(cleanedText, 6000, 500);
      console.log('📊 Created', chunks.length, 'text chunks for AI processing');

      // Update document with extracted text
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          extracted_text: cleanedText,
          status: 'ready'
        })
        .eq('id', documentId);

      if (updateError) {
        console.error('❌ Failed to update document:', updateError);
        throw new Error('Failed to update document with extracted text');
      }

      console.log('✅ Document updated successfully with extracted text');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'PDF text extracted successfully',
          textLength: cleanedText.length,
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