import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request
    const { message, threadId, documentId } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase admin client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Try to get user from auth header if provided
    let userId = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        // Create a client with the user's token to check auth
        const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
          global: {
            headers: {
              Authorization: authHeader,
            },
          },
        });
        
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (user) {
          userId = user.id;
          console.log('Authenticated user:', user.email);
        }
      } catch (e) {
        console.log('Auth check failed, proceeding as anonymous:', e.message);
      }
    }

    // Use a default user ID for anonymous requests (for testing)
    if (!userId) {
      userId = '00000000-0000-0000-0000-000000000000'; // Anonymous user
      console.log('Processing as anonymous user');
    }

    // Get or create thread
    let actualThreadId = threadId;
    
    if (!actualThreadId) {
      const { data: newThread, error: threadError } = await supabaseAdmin
        .from('threads')
        .insert({
          user_id: userId,
          document_id: documentId,
          title: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        })
        .select()
        .single();
      
      if (threadError) {
        console.error('Thread creation error:', threadError);
        throw new Error('Failed to create thread');
      }
      
      actualThreadId = newThread.id;
    }

    // Save user message
    const { data: userMessage, error: userMessageError } = await supabaseAdmin
      .from('messages')
      .insert({
        thread_id: actualThreadId,
        role: 'user',
        content: message,
      })
      .select()
      .single();

    if (userMessageError) {
      console.error('Message save error:', userMessageError);
      throw new Error('Failed to save message');
    }

    // Prepare system prompt
    let systemPrompt = "You are a helpful AI assistant specializing in commercial real estate analysis. Provide clear, accurate, and insightful answers about offering memorandums and real estate investments.";
    
    // Get document context if provided
    if (documentId) {
      const { data: document } = await supabaseAdmin
        .from('documents')
        .select('name, extracted_text')
        .eq('id', documentId)
        .single();

      if (document?.extracted_text) {
        systemPrompt = `You are a helpful AI assistant specializing in commercial real estate analysis. You have access to an offering memorandum titled "${document.name}". Use this document to provide accurate answers about the property and investment opportunity. Always cite specific information from the document when answering questions.`;
        
        // Add document content to system prompt (limited to prevent token overflow)
        systemPrompt += `\n\nDocument excerpt:\n${document.extracted_text.substring(0, 6000)}`;
      }
    }

    // Make OpenAI API call
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        stream: true,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error('Failed to get AI response');
    }

    // Create assistant message placeholder
    const { data: assistantMessage, error: assistantMessageError } = await supabaseAdmin
      .from('messages')
      .insert({
        thread_id: actualThreadId,
        role: 'assistant',
        content: '',
      })
      .select()
      .single();

    if (assistantMessageError) {
      console.error('Assistant message error:', assistantMessageError);
      throw new Error('Failed to create assistant message');
    }

    // Set up streaming response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullContent = '';
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'thread',
                threadId: actualThreadId,
                messageId: assistantMessage.id
              })}\n\n`
            )
          );

          // Process OpenAI stream
          const reader = openaiResponse.body!.getReader();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0]?.delta?.content;
                  
                  if (content) {
                    fullContent += content;
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: 'content',
                          content
                        })}\n\n`
                      )
                    );
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }

          // Update assistant message with full content
          await supabaseAdmin
            .from('messages')
            .update({ content: fullContent })
            .eq('id', assistantMessage.id);

          // Send completion
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done' })}\n\n`
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: error.message
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error) {
    console.error('Chat stream error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});