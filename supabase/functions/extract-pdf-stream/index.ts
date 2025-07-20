import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.min.mjs'
import pdfjsWorker from 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.mjs?worker'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { documentId } = await req.json()

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: 'Document ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Set up SSE headers for streaming
    const headers = new Headers({
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    // Create readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        try {
          // Update status to processing
          await supabaseClient
            .from('documents')
            .update({ status: 'processing' })
            .eq('id', documentId)

          // Download PDF
          const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('documents')
            .download(document.storage_url.split('/').pop()!)

          if (downloadError || !fileData) {
            throw new Error('Failed to download PDF file')
          }

          const buffer = await fileData.arrayBuffer()
          const uint8Array = new Uint8Array(buffer)

          // Configuration
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

          // Load PDF document
          const loadingTask = pdfjsLib.getDocument({ data: uint8Array })
          const pdfDoc = await loadingTask.promise
          const numPages = Math.min(pdfDoc.numPages, MAX_PAGES)

          // Send initial info
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ 
              type: 'start', 
              totalPages: pdfDoc.numPages,
              pagesToProcess: numPages 
            })}\n\n`
          ))

          // Extract text page by page with streaming updates
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            if (totalChars >= MAX_CHARS) {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'limit_reached', 
                  page: pageNum,
                  reason: 'character_limit' 
                })}\n\n`
              ))
              break
            }

            const page = await pdfDoc.getPage(pageNum)
            const textContent = await page.getTextContent()
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ')

            // Check for financial keywords
            const pageKeywords: string[] = []
            for (const keyword of FINANCIAL_KEYWORDS) {
              if (keyword.test(pageText)) {
                const keywordName = keyword.source.replace(/[\\()]/g, '')
                foundSections.add(keywordName)
                pageKeywords.push(keywordName)
              }
            }

            extractedText += `\n--- Page ${pageNum} ---\n${pageText}\n`
            totalChars += pageText.length

            // Send progress update
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ 
                type: 'progress',
                page: pageNum,
                totalPages: numPages,
                charactersExtracted: totalChars,
                keywordsFound: pageKeywords,
                totalKeywordsFound: Array.from(foundSections)
              })}\n\n`
            ))

            // Early exit if most financial sections found
            if (foundSections.size >= FINANCIAL_KEYWORDS.length * 0.8) {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ 
                  type: 'early_exit',
                  page: pageNum,
                  reason: 'found_all_sections' 
                })}\n\n`
              ))
              break
            }
          }

          // Apply final character limit
          if (extractedText.length > MAX_CHARS) {
            extractedText = extractedText.slice(0, MAX_CHARS) + '\n\n[Content truncated at 100k character limit]'
          }

          // Update document with extracted text
          await supabaseClient
            .from('documents')
            .update({
              extracted_text: extractedText,
              status: 'ready'
            })
            .eq('id', documentId)

          // Send completion event
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ 
              type: 'complete',
              totalChars: extractedText.length,
              sectionsFound: Array.from(foundSections)
            })}\n\n`
          ))
          
          controller.enqueue(encoder.encode('event: done\n\n'))
          controller.close()

        } catch (error) {
          console.error('Extraction error:', error)
          
          // Update document status to error
          await supabaseClient
            .from('documents')
            .update({ 
              status: 'error',
              error_message: error.message
            })
            .eq('id', documentId)

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ 
              type: 'error',
              error: error.message 
            })}\n\n`
          ))
          
          controller.close()
        }
      }
    })

    return new Response(stream, { headers })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})