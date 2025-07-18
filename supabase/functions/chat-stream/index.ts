import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  console.log('🚀 Chat-stream function called:', req.method, req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('📋 Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Log request body first
    const requestBody = await req.json();
    console.log('📥 Request body:', requestBody);
    
    const { message, threadId, documentId } = requestBody;
    console.log('📋 Parsed parameters:', { message, threadId, documentId });

    // Create Supabase client
    console.log('🔧 Creating Supabase client...');
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
    console.log('👤 Getting current user...');
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    console.log('👤 User result:', { user: user?.email, userError });

    if (userError) {
      console.error('❌ User authentication error:', userError);
      return new Response(
        JSON.stringify({ error: `Authentication error: ${userError.message}` }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!user) {
      console.error('❌ No user found');
      return new Response(
        JSON.stringify({ error: 'No authenticated user found' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.error('❌ Invalid message:', message);
      return new Response(
        JSON.stringify({ error: 'Message is required and must be a non-empty string' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get or create thread
    console.log('🧵 Looking for existing thread...');
    let thread = null;
    
    if (threadId) {
      console.log('🔍 Searching for thread:', threadId);
      const { data: existingThread, error: threadLookupError } = await supabaseClient
        .from('threads')
        .select('*')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single()
      
      console.log('🔍 Thread lookup result:', { existingThread, threadLookupError });
      
      if (threadLookupError && threadLookupError.code !== 'PGRST116') {
        console.error('❌ Thread lookup error:', threadLookupError);
        return new Response(
          JSON.stringify({ error: `Thread lookup failed: ${threadLookupError.message}` }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      thread = existingThread;
    }

    if (!thread) {
      console.log('🆕 Creating new thread...');
      // Create new thread
      let threadTitle = 'General Chat';
      let threadDocumentId = null;

      if (documentId) {
        console.log('📄 Fetching document for thread creation:', documentId);
        // Create new thread for this document
        const { data: document, error: documentError } = await supabaseClient
          .from('documents')
          .select('name')
          .eq('id', documentId)
          .eq('user_id', user.id)
          .single()

        console.log('📄 Document fetch result:', { document, documentError });

        if (documentError) {
          console.error('❌ Document fetch error:', documentError);
          return new Response(
            JSON.stringify({ error: `Document not found: ${documentError.message}` }),
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        if (document) {
          threadTitle = `Analysis: ${document.name}`;
          threadDocumentId = documentId;
          console.log('📄 Using document for thread:', threadTitle);
        }
      }

      // Create the thread (with or without document)
      console.log('🆕 Creating thread with:', { threadTitle, threadDocumentId, userId: user.id });
      const { data: newThread, error: threadError } = await supabaseClient
        .from('threads')
        .insert({
          user_id: user.id,
          document_id: threadDocumentId,
          title: threadTitle,
        })
        .select()
        .single()
      
      console.log('🆕 Thread creation result:', { newThread, threadError });

      if (threadError) {
        console.error('❌ Thread creation error:', threadError);
        return new Response(
          JSON.stringify({ error: `Failed to create thread: ${threadError.message}` }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      if (!newThread) {
        console.error('❌ Thread creation returned null');
        return new Response(
          JSON.stringify({ error: 'Thread creation returned no data' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      thread = newThread;
    }

    console.log('✅ Using thread:', thread.id, thread.title);

    // Save user message
    console.log('💬 Saving user message...');
    const { data: userMessage, error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        thread_id: thread.id,
        role: 'user',
        content: message,
        status: 'sent',
      })
      .select()
      .single()

    console.log('💬 User message save result:', { userMessage, messageError });

    if (messageError) {
      console.error('❌ Message save error:', messageError);
      return new Response(
        JSON.stringify({ error: `Failed to save message: ${messageError.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get document context if available
    console.log('📚 Loading document context...');
    let documentContext = '';
    if (thread.document_id) {
      console.log('📄 Fetching document content:', thread.document_id);
      const { data: document, error: docError } = await supabaseClient
        .from('documents')
        .select('extracted_text, name')
        .eq('id', thread.document_id)
        .single()

      console.log('📄 Document content result:', { 
        hasDocument: !!document, 
        hasExtractedText: !!document?.extracted_text,
        textLength: document?.extracted_text?.length,
        docError 
      });

      if (docError) {
        console.error('⚠️ Document context error (non-critical):', docError);
      }

      if (document?.extracted_text) {
        documentContext = `
Document: ${document.name}

Content:
${document.extracted_text}

---

Based on this commercial real estate offering memorandum, please provide detailed analysis and answer the user's questions.
        `.trim()
        console.log('📚 Document context loaded, length:', documentContext.length);
      }
    } else {
      console.log('📚 No document associated with thread');
    }

    // Get OpenAI API key
    console.log('🔑 Getting OpenAI API key...');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('❌ OpenAI API key not found in environment');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    console.log('🔑 OpenAI API key found, length:', openaiApiKey.length);

    // Prepare messages for OpenAI
    console.log('🧠 Preparing OpenAI messages...');
    const systemPrompt = `You are an expert commercial real estate analyst. You help investors analyze offering memoranda (OMs) and provide insights about commercial real estate deals.

Key areas to focus on:
- Financial metrics (NOI, Cap Rate, Cash-on-Cash returns)
- Property details and location analysis
- Market conditions and comparables
- Investment risks and opportunities
- Due diligence recommendations

${documentContext ? 
  'Use the provided document as your primary source. Provide clear, professional analysis with specific numbers when available.' : 
  'I can help you with general commercial real estate questions and analysis. For detailed document analysis, you can upload an offering memorandum and I\'ll provide specific insights based on that document.'
}`

    const messages = [
      { role: 'system', content: systemPrompt },
    ]

    if (documentContext) {
      messages.push({ role: 'system', content: documentContext })
      console.log('📚 Added document context to messages');
    }

    // Add recent conversation history
    console.log('📜 Loading conversation history...');
    const { data: recentMessages, error: historyError } = await supabaseClient
      .from('messages')
      .select('role, content')
      .eq('thread_id', thread.id)
      .neq('id', userMessage.id)
      .order('created_at', { ascending: false })
      .limit(10)

    console.log('📜 History result:', { 
      messageCount: recentMessages?.length, 
      historyError 
    });

    if (historyError) {
      console.error('⚠️ History load error (non-critical):', historyError);
    }

    if (recentMessages && recentMessages.length > 0) {
      // Add in chronological order
      recentMessages.reverse().forEach(msg => {
        messages.push({ role: msg.role, content: msg.content })
      })
      console.log('📜 Added', recentMessages.length, 'previous messages');
    }

    // Add current user message
    messages.push({ role: 'user', content: message })

    console.log('🧠 Final message count:', messages.length);
    console.log('🧠 OpenAI request payload:', {
      model: 'gpt-4o-mini',
      messageCount: messages.length,
      stream: true,
      max_tokens: 2000,
      temperature: 0.7,
    });

    // Create streaming response
    console.log('🌊 Making OpenAI API call...');
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

    console.log('🌊 OpenAI response status:', response.status);
    console.log('🌊 OpenAI response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: errorText }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Set up Server-Sent Events
    console.log('📡 Setting up streaming response...');
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
          console.log('🤖 Creating assistant message record...');
          // Create assistant message record
          const { data: assistantMessage, error: assistantError } = await supabaseClient
            .from('messages')
            .insert({
              thread_id: thread.id,
              role: 'assistant',
              content: '',
              status: 'streaming',
            })
            .select()
            .single()

          console.log('🤖 Assistant message result:', { assistantMessage, assistantError });

          if (assistantError) {
            console.error('❌ Assistant message creation error:', assistantError);
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'error', error: `Failed to create assistant message: ${assistantError.message}` })}\n\n`
              )
            )
            controller.close()
            return
          }

          // Send initial message with thread info
          console.log('📤 Sending initial thread info...');
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
          if (!reader) {
            console.error('❌ No response body from OpenAI');
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ type: 'error', error: 'No response body from OpenAI' })}\n\n`
              )
            )
            controller.close()
            return
          }

          const decoder = new TextDecoder()
          console.log('🌊 Starting to read OpenAI stream...');

          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              console.log('✅ OpenAI stream completed');
              break
            }

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                
                if (data === '[DONE]') {
                  console.log('🎯 OpenAI stream finished');
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
                  console.log('⚠️ Skipping invalid JSON chunk:', data.substring(0, 50));
                }
              }
            }
          }
        } catch (error) {
          console.error('💥 Streaming error:', error)
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    console.log('✅ Returning streaming response');
    return new Response(stream, { headers })

  } catch (error) {
    console.error('💥 Fatal error in chat-stream function:', error);
    console.error('💥 Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})