#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.min.mjs'
import pdf from 'https://esm.sh/pdf-parse@1.1.1'

// Supabase configuration
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://npsqlaumhzzlqjtycpim.supabase.co'
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || 'your-anon-key-here'

interface BenchmarkResult {
  method: string
  totalPages: number
  pagesProcessed: number
  totalTimeMs: number
  timePerPageMs: number
  charactersExtracted: number
  memoryUsedMb: number
}

async function benchmarkPdfParse(pdfBuffer: ArrayBuffer): Promise<BenchmarkResult> {
  console.log('\n📊 Benchmarking pdf-parse (original method)...')
  const startTime = performance.now()
  const startMemory = Deno.memoryUsage()
  
  try {
    const data = await pdf(pdfBuffer, { max: 10 })
    const endTime = performance.now()
    const endMemory = Deno.memoryUsage()
    
    const result: BenchmarkResult = {
      method: 'pdf-parse',
      totalPages: data.numpages,
      pagesProcessed: Math.min(10, data.numpages),
      totalTimeMs: Math.round(endTime - startTime),
      timePerPageMs: Math.round((endTime - startTime) / Math.min(10, data.numpages)),
      charactersExtracted: data.text.length,
      memoryUsedMb: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)
    }
    
    return result
  } catch (error) {
    console.error('pdf-parse error:', error)
    throw error
  }
}

async function benchmarkPdfjs(pdfBuffer: ArrayBuffer): Promise<BenchmarkResult> {
  console.log('\n📊 Benchmarking pdfjs-dist (WebAssembly method)...')
  const startTime = performance.now()
  const startMemory = Deno.memoryUsage()
  
  try {
    const uint8Array = new Uint8Array(pdfBuffer)
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array })
    const pdfDoc = await loadingTask.promise
    
    let extractedText = ''
    const maxPages = Math.min(10, pdfDoc.numPages)
    
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdfDoc.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      extractedText += pageText + '\n'
    }
    
    const endTime = performance.now()
    const endMemory = Deno.memoryUsage()
    
    const result: BenchmarkResult = {
      method: 'pdfjs-dist',
      totalPages: pdfDoc.numPages,
      pagesProcessed: maxPages,
      totalTimeMs: Math.round(endTime - startTime),
      timePerPageMs: Math.round((endTime - startTime) / maxPages),
      charactersExtracted: extractedText.length,
      memoryUsedMb: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)
    }
    
    return result
  } catch (error) {
    console.error('pdfjs-dist error:', error)
    throw error
  }
}

async function benchmarkPdftotext(pdfPath: string): Promise<BenchmarkResult | null> {
  console.log('\n📊 Benchmarking pdftotext (native binary)...')
  
  try {
    // Check if pdftotext is available
    const checkCommand = new Deno.Command('which', { args: ['pdftotext'] })
    const checkResult = await checkCommand.output()
    
    if (checkResult.code !== 0) {
      console.log('⚠️  pdftotext not found. Install with: brew install poppler (macOS) or apt-get install poppler-utils (Linux)')
      return null
    }
    
    const startTime = performance.now()
    const startMemory = Deno.memoryUsage()
    
    // Get page count first
    const infoCommand = new Deno.Command('pdfinfo', { 
      args: [pdfPath],
      stdout: 'piped',
    })
    const infoResult = await infoCommand.output()
    const infoText = new TextDecoder().decode(infoResult.stdout)
    const pagesMatch = infoText.match(/Pages:\s+(\d+)/)
    const totalPages = pagesMatch ? parseInt(pagesMatch[1]) : 0
    
    // Extract text
    const command = new Deno.Command('pdftotext', {
      args: ['-f', '1', '-l', '10', '-layout', pdfPath, '-'],
      stdout: 'piped',
    })
    
    const { stdout } = await command.output()
    const extractedText = new TextDecoder().decode(stdout)
    
    const endTime = performance.now()
    const endMemory = Deno.memoryUsage()
    
    const result: BenchmarkResult = {
      method: 'pdftotext',
      totalPages: totalPages,
      pagesProcessed: Math.min(10, totalPages),
      totalTimeMs: Math.round(endTime - startTime),
      timePerPageMs: Math.round((endTime - startTime) / Math.min(10, totalPages)),
      charactersExtracted: extractedText.length,
      memoryUsedMb: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024)
    }
    
    return result
  } catch (error) {
    console.error('pdftotext error:', error)
    return null
  }
}

function printResults(results: BenchmarkResult[]) {
  console.log('\n📈 BENCHMARK RESULTS:')
  console.log('═'.repeat(80))
  
  // Header
  console.log(
    'Method'.padEnd(15) +
    'Pages'.padEnd(10) +
    'Total Time'.padEnd(12) +
    'Time/Page'.padEnd(12) +
    'Characters'.padEnd(12) +
    'Memory (MB)'
  )
  console.log('─'.repeat(80))
  
  // Results
  for (const result of results) {
    console.log(
      result.method.padEnd(15) +
      `${result.pagesProcessed}/${result.totalPages}`.padEnd(10) +
      `${result.totalTimeMs}ms`.padEnd(12) +
      `${result.timePerPageMs}ms`.padEnd(12) +
      result.charactersExtracted.toString().padEnd(12) +
      result.memoryUsedMb.toString()
    )
  }
  
  console.log('═'.repeat(80))
  
  // Find winner
  const fastest = results.reduce((prev, curr) => 
    curr.timePerPageMs < prev.timePerPageMs ? curr : prev
  )
  
  console.log(`\n🏆 Fastest method: ${fastest.method} (${fastest.timePerPageMs}ms per page)`)
  
  // Performance comparison
  console.log('\n📊 Performance comparison:')
  for (const result of results) {
    if (result.method !== fastest.method) {
      const speedup = (result.timePerPageMs / fastest.timePerPageMs).toFixed(2)
      console.log(`   ${result.method} is ${speedup}x slower than ${fastest.method}`)
    }
  }
}

async function main() {
  console.log('🚀 PDF Extraction Benchmark Tool')
  console.log('================================\n')
  
  // Get PDF file path from command line or use default
  const pdfPath = Deno.args[0] || './test-files/sample-om.pdf'
  
  console.log(`📄 Testing with: ${pdfPath}`)
  
  try {
    // Read PDF file
    const pdfBuffer = await Deno.readFile(pdfPath)
    const fileSizeMb = (pdfBuffer.byteLength / 1024 / 1024).toFixed(2)
    console.log(`📦 File size: ${fileSizeMb} MB`)
    
    const results: BenchmarkResult[] = []
    
    // Benchmark pdf-parse
    try {
      const pdfParseResult = await benchmarkPdfParse(pdfBuffer.buffer)
      results.push(pdfParseResult)
    } catch (error) {
      console.error('❌ pdf-parse benchmark failed:', error.message)
    }
    
    // Benchmark pdfjs-dist
    try {
      const pdfjsResult = await benchmarkPdfjs(pdfBuffer.buffer)
      results.push(pdfjsResult)
    } catch (error) {
      console.error('❌ pdfjs-dist benchmark failed:', error.message)
    }
    
    // Benchmark pdftotext
    const pdftotextResult = await benchmarkPdftotext(pdfPath)
    if (pdftotextResult) {
      results.push(pdftotextResult)
    }
    
    // Print results
    if (results.length > 0) {
      printResults(results)
    } else {
      console.error('❌ All benchmarks failed!')
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
    Deno.exit(1)
  }
}

// Run benchmark
if (import.meta.main) {
  await main()
}