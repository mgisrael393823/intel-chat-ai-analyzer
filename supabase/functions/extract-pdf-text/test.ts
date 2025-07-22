import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

// Mock Supabase client
const createMockSupabaseClient = (
  mockDocument: Record<string, unknown>,
  mockFileData: Blob | null,
  downloadError: unknown = null
) => {
  return {
    from: (table: string) => {
      if (table === 'documents') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ 
                data: mockDocument, 
                error: mockDocument ? null : { message: 'Document not found' } 
              })
            })
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null })
          })
        };
      }
      return {};
    },
    storage: {
      from: (bucket: string) => ({
        download: (path: string) => {
          console.log(`Mock download called with path: ${path}`);
          return Promise.resolve({
            data: mockFileData,
            error: downloadError
          });
        }
      })
    }
  };
};

// Test helper to extract file path from storage URL
function extractFilePathFromUrl(storageUrl: string): string {
  const urlParts = storageUrl.split('/');
  const pathIndex = urlParts.indexOf('documents');
  if (pathIndex === -1 || pathIndex + 2 >= urlParts.length) {
    throw new Error('Invalid storage URL format');
  }
  return urlParts.slice(pathIndex + 1).join('/');
}

Deno.test("Extract file path from storage URL", () => {
  const storageUrl = "https://npsqlaumhzzlqjtycpim.supabase.co/storage/v1/object/public/documents/user123/file456.pdf";
  const expectedPath = "user123/file456.pdf";
  
  const extractedPath = extractFilePathFromUrl(storageUrl);
  assertEquals(extractedPath, expectedPath);
});

Deno.test("Handle invalid storage URL format", () => {
  const invalidUrls = [
    "https://example.com/no-documents-path",
    "https://example.com/documents", // No file path after documents
    ""
  ];
  
  for (const url of invalidUrls) {
    try {
      extractFilePathFromUrl(url);
      throw new Error("Should have thrown error");
    } catch (error) {
      assertEquals(error.message, "Invalid storage URL format");
    }
  }
});

Deno.test("Mock storage download success", async () => {
  const mockDocument = {
    id: "test-123",
    storage_url: "https://npsqlaumhzzlqjtycpim.supabase.co/storage/v1/object/public/documents/user123/test.pdf",
    user_id: "user123"
  };
  
  const mockPdfContent = new Blob(["Mock PDF content"], { type: "application/pdf" });
  const mockClient = createMockSupabaseClient(mockDocument, mockPdfContent);
  
  // Simulate the download process
  const filePath = extractFilePathFromUrl(mockDocument.storage_url);
  const { data, error } = await mockClient.storage.from('documents').download(filePath);
  
  assertExists(data);
  assertEquals(error, null);
  assertEquals(await data.text(), "Mock PDF content");
});

Deno.test("Mock storage download failure", async () => {
  const mockDocument = {
    id: "test-123",
    storage_url: "https://npsqlaumhzzlqjtycpim.supabase.co/storage/v1/object/public/documents/user123/missing.pdf",
    user_id: "user123"
  };
  
  const downloadError = { message: "Object not found", statusCode: "404" };
  const mockClient = createMockSupabaseClient(mockDocument, null, downloadError);
  
  // Simulate the download process
  const filePath = extractFilePathFromUrl(mockDocument.storage_url);
  const { data, error } = await mockClient.storage.from('documents').download(filePath);
  
  assertEquals(data, null);
  assertExists(error);
  assertEquals(error.message, "Object not found");
});

Deno.test("Document not found in database", async () => {
  const mockClient = createMockSupabaseClient(null, null);
  
  // Simulate document lookup
  const { data, error } = await mockClient.from('documents')
    .select('*')
    .eq('id', 'non-existent')
    .single();
  
  assertEquals(data, null);
  assertExists(error);
  assertEquals(error.message, "Document not found");
});

// Run tests with: deno test --allow-net test.ts