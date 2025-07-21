import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import OpenAI from 'https://deno.land/x/openai@v4.27.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { messages, model = 'gpt-4o-mini', temperature = 0.7 } = await req.json();
    const openai = new OpenAI(Deno.env.get('OPENAI_API_KEY')!);

    const stream = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      stream: true
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const part of stream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(part)}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
