
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

    // Initialize Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Authentication handling
    let userId = null;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        
        if (!error && user) {
          userId = user.id;
          console.log('Authenticated user:', user.email || user.id);
        }
      } catch (e) {
        console.error('Auth check failed:', e);
      }
    }

    // Handle anonymous users
    if (!userId) {
      console.log('No authenticated user found, creating anonymous session');
      
      try {
        const { data: anonData, error: anonError } = await supabaseAdmin.auth.signInAnonymously();
        
        if (anonError || !anonData.user) {
          console.error('Failed to create anonymous session:', anonError);
          throw new Error('Authentication required. Please sign in to use chat.');
        }
        
        userId = anonData.user.id;
        console.log('Created anonymous session with ID:', userId);
      } catch (e) {
        console.error('Anonymous session creation failed:', e);
        throw new Error('Authentication required. Please sign in to use chat.');
      }
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
        throw new Error(`Failed to create thread: ${threadError.message}`);
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

    // Enhanced system prompt with financial document expertise
    let systemPrompt = `You are an expert commercial real estate analyst and investment advisor with deep expertise in analyzing offering memorandums (OMs), investment packages, and financial documents.

**Your Core Expertise:**
- Financial Analysis: NOI, cap rates, cash flow analysis, DCF modeling, sensitivity analysis
- Market Analysis: Comparables, market trends, submarket dynamics, demographic analysis  
- Due Diligence: Risk assessment, environmental concerns, legal issues, tenant analysis
- Property Types: Multifamily, office, retail, industrial, mixed-use, hospitality, self-storage
- Investment Metrics: IRR, NPV, equity multiple, DSCR, LTV, yield on cost
- Real Estate Finance: Debt structuring, equity partnerships, tax considerations

**Response Guidelines:**
1. **Be Specific & Data-Driven**: Always reference exact numbers, percentages, and metrics from the document
2. **Financial Focus**: Prioritize financial analysis and investment implications
3. **Risk Assessment**: Identify both opportunities and risks in every analysis  
4. **Industry Terminology**: Use proper CRE terminology and standard industry metrics
5. **Actionable Insights**: Provide practical recommendations and next steps
6. **Context Awareness**: Consider market conditions and property type specifics

**Document Analysis Approach:**
- Extract and analyze key financial metrics (rent roll, NOI, expenses, cap rates)
- Identify value-add opportunities and potential risks
- Compare to market standards and benchmarks
- Highlight unusual or noteworthy terms/conditions
- Assess the strength of tenant base and lease terms
- Evaluate location and market factors

Always be thorough, professional, and focused on helping users make informed investment decisions.`;
    
    // Get document context with validation
    if (documentId) {
      const { data: document } = await supabaseAdmin
        .from('documents')
        .select('name, extracted_text, type, size, status, error_message')
        .eq('id', documentId)
        .single();

      if (document) {
        if (document.status === 'error') {
          systemPrompt += `\n\n**DOCUMENT ERROR:**
Document "${document.name}" failed to process. Error: ${document.error_message || 'Unknown error'}
Please inform the user that the document needs to be re-uploaded or re-processed.`;
        } else if (document.status === 'processing') {
          systemPrompt += `\n\n**DOCUMENT PROCESSING:**
Document "${document.name}" is still being processed. Please inform the user to wait for processing to complete before asking detailed questions.`;
        } else if (document.extracted_text && document.status === 'ready') {
          // Validate that extracted text is actually readable (not binary data)
          const textSample = document.extracted_text.substring(0, 200);
          const isBinaryData = textSample.includes('<<') && textSample.includes('>>') && textSample.includes('/');
          const hasReadableText = /[a-zA-Z]{10,}/.test(textSample);
          
          if (isBinaryData && !hasReadableText) {
            console.log('Detected binary data in extracted_text, marking for re-processing');
            
            // Mark document for re-processing
            await supabaseAdmin
              .from('documents')
              .update({ 
                status: 'error',
                error_message: 'Binary data detected - needs re-processing'
              })
              .eq('id', documentId);
              
            systemPrompt += `\n\n**DOCUMENT RE-PROCESSING NEEDED:**
Document "${document.name}" contains binary data instead of readable text and needs to be re-processed. Please inform the user that there was an issue with text extraction and they should try re-uploading the document.`;
          } else {
            // Use extracted text if it's valid
            const maxContextLength = 20000; // Increased context window
            let documentContext = document.extracted_text;
            
            console.log(`Document context available: ${documentContext.length} characters`);
            
            if (documentContext.length > maxContextLength) {
              // Intelligent truncation - prioritize financial sections
              const sections = documentContext.split(/\n\s*\n/);
              let truncatedContext = '';
              let prioritySections = '';
              
              // Look for financial keywords first
              const financialKeywords = /(?:noi|net operating income|cap rate|cash flow|rent roll|financial|income|expenses|returns?|irr|investment|property|lease|tenant)/i;
              
              for (const section of sections) {
                if (financialKeywords.test(section)) {
                  if (prioritySections.length + section.length < maxContextLength * 0.7) {
                    prioritySections += section + '\n\n';
                  }
                }
              }
              
              // Fill remaining space with other content
              const remainingSpace = maxContextLength - prioritySections.length;
              for (const section of sections) {
                if (!financialKeywords.test(section) && truncatedContext.length + section.length < remainingSpace) {
                  truncatedContext += section + '\n\n';
                }
              }
              
              documentContext = prioritySections + truncatedContext;
            }

            systemPrompt += `\n\n**CURRENT DOCUMENT ANALYSIS:**
Document: "${document.name}"
Type: ${document.type || 'PDF'}
Size: ${Math.round((document.size || 0) / 1024)} KB
Status: ${document.status}

**FULL DOCUMENT CONTENT:**
${documentContext}

**ANALYSIS INSTRUCTIONS:**
- This document contains commercial real estate information that you should analyze thoroughly
- Look for key financial metrics, property details, market information, and investment terms
- Reference specific numbers, percentages, and data points from the document in your responses
- If the user asks general questions, relate them back to this specific property/deal when relevant
- Focus on practical investment insights and actionable recommendations`;
            
            console.log(`Enhanced document context prepared: ${documentContext.length} characters`);
          }
        } else {
          console.log('No extracted text found for document');
          systemPrompt += `\n\nNote: Document "${document?.name || 'Unknown'}" is available but text extraction may still be in progress or failed. If the user asks about the document, let them know the content is not yet accessible for analysis.`;
        }
      }
    }

    // Enhanced OpenAI API call
    let openaiResponse;
    
    try {
      // Use GPT-4o for better document analysis
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.1, // Lower for more consistent analysis
          stream: true,
          max_tokens: 3000,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', errorText);
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error.message}`);
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
        error: error.message || 'Internal server error',
        details: 'Enhanced chat system with document validation'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
