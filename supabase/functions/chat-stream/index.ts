import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { message, threadId, documentId } = await req.json()

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get or create thread
    let thread;
    if (threadId) {
      const { data: existingThread } = await supabaseClient
        .from('threads')
        .select('*')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single()
      
      thread = existingThread;
    }

    if (!thread && documentId) {
      // Create new thread for this document
      const { data: document } = await supabaseClient
        .from('documents')
        .select('name')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single()

      if (document) {
        const { data: newThread } = await supabaseClient
          .from('threads')
          .insert({
            user_id: user.id,
            document_id: documentId,
            title: `Analysis: ${document.name}`,
          })
          .select()
          .single()
        
        thread = newThread;
      }
    }

    if (!thread) {
      return new Response(
        JSON.stringify({ error: 'Thread not found or could not be created' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Save user message
    const { data: userMessage } = await supabaseClient
      .from('messages')
      .insert({
        thread_id: thread.id,
        role: 'user',
        content: message,
        status: 'sent',
      })
      .select()
      .single()

    // Get document context if available
    let documentContext = '';
    if (thread.document_id) {
      const { data: document } = await supabaseClient
        .from('documents')
        .select('extracted_text, name')
        .eq('id', thread.document_id)
        .single()

      if (document?.extracted_text) {
        documentContext = `
Document: ${document.name}

Content:
${document.extracted_text}

---

Based on this commercial real estate offering memorandum, please provide detailed analysis and answer the user's questions.
        `.trim()
      }
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Prepare messages for OpenAI
    const systemPrompt = `You are an expert commercial real estate analyst. You help investors analyze offering memoranda (OMs) and provide insights about commercial real estate deals.

Key areas to focus on:
- Financial metrics (NOI, Cap Rate, Cash-on-Cash returns)
- Property details and location analysis
- Market conditions and comparables
- Investment risks and opportunities
- Due diligence recommendations

Provide clear, professional analysis with specific numbers when available. ${documentContext ? 'Use the provided document as your primary source.' : 'Ask for document upload if no context is provided.'}`

    const messages = [
      { role: 'system', content: systemPrompt },
    ]

    if (documentContext) {
      messages.push({ role: 'system', content: documentContext })
    }

    // Add recent conversation history
    const { data: recentMessages } = await supabaseClient
      .from('messages')
      .select('role, content')
      .eq('thread_id', thread.id)
      .neq('id', userMessage.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (recentMessages) {
      // Add in chronological order
      recentMessages.reverse().forEach(msg => {
        messages.push({ role: msg.role, content: msg.content })
      })
    }

    // Add current user message
    messages.push({ role: 'user', content: message })

    // Create streaming response
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        stream: true,
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    // Set up Server-Sent Events
    const headers = {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }

    let assistantMessageContent = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create assistant message record
          const { data: assistantMessage } = await supabaseClient
            .from('messages')
            .insert({
              thread_id: thread.id,
              role: 'assistant',
              content: '',
              status: 'streaming',
            })
            .select()
            .single()

          // Send initial message with thread info
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ 
                type: 'thread', 
                threadId: thread.id, 
                messageId: assistantMessage.id 
              })}\n\n`
            )
          )

          const reader = response.body?.getReader()
          if (!reader) throw new Error('No response body')

          const decoder = new TextDecoder()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                
                if (data === '[DONE]') {
                  // Finalize assistant message
                  await supabaseClient
                    .from('messages')
                    .update({
                      content: assistantMessageContent,
                      status: 'sent',
                    })
                    .eq('id', assistantMessage.id)

                  // Log usage
                  await supabaseClient
                    .from('usage_logs')
                    .insert({
                      user_id: user.id,
                      action: 'chat_message',
                      document_id: thread.document_id,
                    })

                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
                  )
                  controller.close()
                  return
                }

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  
                  if (content) {
                    assistantMessageContent += content
                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify({ type: 'content', content })}\n\n`
                      )
                    )
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Streaming error:', error)
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(stream, { headers })

  } catch (error) {
    console.error('Chat stream error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})