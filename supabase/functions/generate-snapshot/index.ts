
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    if (!document.extracted_text) {
      throw new Error('Document text has not been extracted yet');
    }

    console.log(`Generating snapshot for document: ${document.name}`);
    console.log(`Document text length: ${document.extracted_text.length} characters`);

    // Enhanced prompt for better financial analysis
    const prompt = `Analyze this commercial real estate offering memorandum and extract key investment information. Return a JSON object with the following structure:

{
  "propertyName": "string",
  "address": "string", 
  "propertyType": "string",
  "askingPrice": number (in dollars, no commas),
  "noi": number (net operating income in dollars),
  "capRate": number (as percentage, e.g., 5.5 for 5.5%),
  "occupancy": number (as percentage),
  "totalUnits": number (if applicable),
  "yearBuilt": number,
  "highlights": ["string", "string", ...] (3-5 key selling points),
  "risks": ["string", "string", ...] (3-5 key risks or concerns)
}

**Financial Analysis Guidelines:**
- Look for NOI (Net Operating Income), cap rate, and asking price prominently
- Calculate cap rate if not explicitly stated (NOI / Asking Price * 100)
- Extract occupancy rates, lease terms, and tenant information
- Identify value-add opportunities and potential risks
- Focus on quantifiable metrics and specific details

**Property Information:**
- Extract exact address and property type
- Look for unit count, square footage, year built
- Note any recent improvements or capital expenditures

**Investment Highlights & Risks:**
- Highlights should focus on positive investment attributes
- Risks should identify potential concerns or challenges
- Be specific and quantifiable where possible

Document to analyze:
${document.extracted_text.substring(0, 15000)}`;

    // Call OpenAI with enhanced model
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Upgraded model
          messages: [
            {
              role: 'system',
              content: 'You are an expert commercial real estate analyst. Analyze offering memorandums and extract key financial and investment data. Always return valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1, // Low temperature for consistent extraction
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        console.log('Primary model failed, trying fallback...');
        // Fallback to gpt-4o-mini
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an expert commercial real estate analyst. Analyze offering memorandums and extract key financial and investment data. Always return valid JSON.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.1,
            max_tokens: 1500,
          }),
        });
        
        if (!response.ok) {
          throw new Error('Both OpenAI models failed');
        }
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate snapshot: ${error.message}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    console.log('Raw OpenAI response:', content);

    // Parse JSON response with enhanced error handling
    let snapshot;
    try {
      // Clean the content to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      snapshot = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      console.log('Raw content:', content);
      
      // Fallback: create a basic snapshot from available data
      snapshot = {
        propertyName: document.name.replace('.pdf', ''),
        address: 'Address not extracted',
        propertyType: 'Commercial Real Estate',
        askingPrice: null,
        noi: null,
        capRate: null,
        occupancy: null,
        totalUnits: null,
        yearBuilt: null,
        highlights: ['Professional offering memorandum available'],
        risks: ['Detailed analysis required']
      };
    }

    // Log usage
    try {
      await supabase
        .from('usage_logs')
        .insert({
          user_id: document.user_id,
          action: 'document_snapshot',
          document_id: documentId
        });
    } catch (logError) {
      console.error('Failed to log usage:', logError);
      // Don't fail the main request for logging errors
    }

    console.log('Generated snapshot:', snapshot);

    return new Response(
      JSON.stringify({
        success: true,
        documentName: document.name,
        snapshot: snapshot
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Snapshot generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Enhanced snapshot generation with improved analysis'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
