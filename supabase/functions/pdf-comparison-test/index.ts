import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Test different PDF parsing approaches with real PDF data
console.log("🧪 PDF Parser Comparison Test initializing...");

// Create a minimal valid PDF for testing
function createTestPDF(): Uint8Array {
  // Minimal PDF with "Hello World" text
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
72 720 Td
(Hello World PDF Test) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000251 00000 n 
0000000318 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
410
%%EOF`;
  
  return new TextEncoder().encode(pdfContent);
}

// Option 1: Current PDF.js approach
async function testPDFJS(): Promise<{ success: boolean, extractedText?: string, error?: string, timeMs?: number }> {
  const startTime = Date.now();
  
  try {
    console.log("Testing PDF.js import...");
    const pdfModule = await import("https://esm.sh/pdfjs-dist@3.11.174/build/pdf.js");
    const { getDocument } = pdfModule;
    
    console.log("PDF.js imported successfully, testing extraction...");
    const testBuffer = createTestPDF();
    
    const loadingTask = getDocument({ data: testBuffer });
    const pdf = await loadingTask.promise;
    
    // Limit to first page only for fair comparison
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    
    const extractedText = textContent.items
      .map((item: any) => item.str)
      .join(" ")
      .trim();
    
    // Clean up
    if (pdf.destroy) {
      await pdf.destroy();
    }
    
    return { 
      success: true, 
      extractedText, 
      timeMs: Date.now() - startTime 
    };
  } catch (error) {
    console.error("PDF.js test failed:", error);
    return { 
      success: false, 
      error: error.message, 
      timeMs: Date.now() - startTime 
    };
  }
}

// Option 2: unpdf approach
async function testUnpdf(): Promise<{ success: boolean, extractedText?: string, error?: string, timeMs?: number }> {
  const startTime = Date.now();
  
  try {
    console.log("Testing unpdf import...");
    const unpdfModule = await import("https://esm.sh/unpdf@0.11.0");
    const { extractText } = unpdfModule.default || unpdfModule;
    
    console.log("unpdf imported successfully, testing extraction...");
    const testBuffer = createTestPDF();
    
    const result = await extractText(testBuffer);
    const extractedText = Array.isArray(result) ? result.join(" ") : result;
    
    return { 
      success: true, 
      extractedText: extractedText.trim(), 
      timeMs: Date.now() - startTime 
    };
  } catch (error) {
    console.log("unpdf failed, trying pdf2json fallback...");
    try {
      const pdf2jsonModule = await import("https://esm.sh/pdf2json@3.1.4");
      // pdf2json has different API, would need file path
      console.log("pdf2json imported but needs file system access");
      return { 
        success: false, 
        error: "pdf2json requires file system access, not suitable for edge runtime",
        timeMs: Date.now() - startTime 
      };
    } catch (altError) {
      console.error("Both unpdf and pdf2json failed:", error, altError);
      return { 
        success: false, 
        error: `unpdf: ${error.message}, pdf2json: ${altError.message}`, 
        timeMs: Date.now() - startTime 
      };
    }
  }
}

// Option 3: Minimal PDF parser (custom implementation)
async function testMinimalParser(): Promise<{ success: boolean, extractedText?: string, error?: string, timeMs?: number }> {
  const startTime = Date.now();
  
  try {
    console.log("Testing minimal parser...");
    const testBuffer = createTestPDF();
    
    // Simple PDF text extraction using regex patterns
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(testBuffer);
    
    // Look for text between parentheses in PDF streams
    const textRegex = /\((.*?)\)\s*Tj/g;
    const matches = [];
    let match;
    
    while ((match = textRegex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    
    const extractedText = matches.join(" ").trim();
    
    return { 
      success: true, 
      extractedText, 
      timeMs: Date.now() - startTime 
    };
  } catch (error) {
    console.error("Minimal parser failed:", error);
    return { 
      success: false, 
      error: error.message, 
      timeMs: Date.now() - startTime 
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    });
  }

  console.log("🚀 Running PDF parser comparison with real PDF...");
  
  const results = {
    timestamp: new Date().toISOString(),
    testPdfSize: createTestPDF().length,
    expectedText: "Hello World PDF Test",
    tests: {
      pdfjs: await testPDFJS(),
      unpdf: await testUnpdf(), 
      minimal: await testMinimalParser()
    },
    analysis: {
      recommendations: [],
      performance: [],
      accuracy: []
    }
  };
  
  // Analyze results
  const tests = results.tests;
  
  // Performance analysis
  if (tests.pdfjs.success) {
    results.analysis.performance.push(`PDF.js: ${tests.pdfjs.timeMs}ms - Full-featured but slower`);
    results.analysis.accuracy.push(`PDF.js: "${tests.pdfjs.extractedText}" (${tests.pdfjs.extractedText?.length || 0} chars)`);
  }
  
  if (tests.unpdf.success) {
    results.analysis.performance.push(`unpdf: ${tests.unpdf.timeMs}ms - Potentially faster`);
    results.analysis.accuracy.push(`unpdf: "${tests.unpdf.extractedText}" (${tests.unpdf.extractedText?.length || 0} chars)`);
  }
  
  if (tests.minimal.success) {
    results.analysis.performance.push(`Minimal: ${tests.minimal.timeMs}ms - Fastest`);
    results.analysis.accuracy.push(`Minimal: "${tests.minimal.extractedText}" (${tests.minimal.extractedText?.length || 0} chars)`);
  }
  
  // Generate recommendations
  const successCount = [tests.pdfjs.success, tests.unpdf.success, tests.minimal.success].filter(Boolean).length;
  
  if (successCount === 0) {
    results.analysis.recommendations.push("⚠️ All parsers failed - investigate Edge Runtime compatibility");
  } else {
    if (tests.pdfjs.success) {
      results.analysis.recommendations.push("✅ PDF.js: Proven, accurate, but largest bundle");
    }
    if (tests.unpdf.success) {
      results.analysis.recommendations.push("✅ unpdf: Modern alternative worth considering");
    }
    if (tests.minimal.success) {
      results.analysis.recommendations.push("✅ Minimal: Ultra-light fallback option");
    }
  }
  
  return new Response(
    JSON.stringify(results, null, 2),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  );
});

console.log("✅ PDF Parser Comparison Test ready with real PDF sample");