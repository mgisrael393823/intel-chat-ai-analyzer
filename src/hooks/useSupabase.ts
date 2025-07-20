import { supabase } from '@/integrations/supabase/client';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

export interface Document {
  id: string;
  name: string;
  size: number;
  type: string;
  storage_url: string;
  extracted_text?: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  upload_progress?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export const useSupabase = () => {
  const uploadFile = async (file: File): Promise<Document> => {
    console.log('📁 uploadFile called with:', { name: file.name, size: file.size, type: file.type });
    
    try {
      // Get current user session - try localStorage first due to getSession hanging
      console.log('🔐 Getting session for upload...');
      
      let session: any = null;
      let sessionError: any = null;
      
      // Try getting from localStorage first (same as sendMessage fix)
      const storageKey = `sb-${supabase.supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
      const storedSession = localStorage.getItem(storageKey);
      
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          if (parsed?.access_token) {
            session = { access_token: parsed.access_token, user: parsed.user };
            console.log('✅ Got session from localStorage for upload');
          }
        } catch (e) {
          console.error('Failed to parse stored session:', e);
        }
      }
      
      // Fallback to getSession if localStorage didn't work
      if (!session) {
        console.log('⚠️ No localStorage session, trying getSession...');
        const result = await supabase.auth.getSession();
        session = result.data.session;
        sessionError = result.error;
      }
      
      console.log('🔐 Session result:', { hasSession: !!session, sessionError });
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please sign in to upload files.');
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      console.log('📤 FormData created with file');

      // Call the upload-pdf edge function
      const url = `${supabase.supabaseUrl}/functions/v1/upload-pdf`;
      console.log('⏳ Starting upload to edge function:', url);
      console.log('🔑 Using auth token:', session.access_token?.slice(0, 20) + '...');
      
      console.log('🚀 About to invoke upload-pdf function...');
      
      // Try direct fetch instead of supabase.functions.invoke
      try {
        console.log('📡 Using direct fetch to bypass SDK...');
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        
        console.log('📡 Fetch response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Upload fetch error:', errorText);
          throw new Error(`Upload failed: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log('📡 Fetch response data:', responseData);
        
        var data = responseData;
        var error = null;
      } catch (fetchError) {
        console.error('❌ Direct fetch failed:', fetchError);
        throw fetchError;
      }
      
      console.log('✅ upload-pdf response:', { data, error });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(error.message || 'Failed to upload file');
      }

      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      return data.document;
    } catch (error) {
      console.error('Upload file error:', error);
      throw error;
    }
  };

  const getDocument = async (id: string): Promise<Document | null> => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Get document error:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Get document error:', error);
      return null;
    }
  };

  const getUserDocuments = async (): Promise<Document[]> => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get user documents error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Get user documents error:', error);
      return [];
    }
  };

  const deleteDocument = async (id: string): Promise<boolean> => {
    try {
      // First get the document to get storage path
      const document = await getDocument(id);
      if (!document) {
        throw new Error('Document not found');
      }

      // Delete from storage
      const fileName = document.storage_url.split('/').pop();
      if (fileName) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([fileName]);

        if (storageError) {
          console.error('Storage deletion error:', storageError);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Database deletion error:', error);
        throw new Error('Failed to delete document');
      }

      return true;
    } catch (error) {
      console.error('Delete document error:', error);
      return false;
    }
  };

  const extractPdfText = async (
    documentId: string, 
    onProgress?: (data: any) => void
  ): Promise<boolean> => {
    try {
      // Get session from localStorage to avoid hanging
      const storageKey = `sb-${supabase.supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
      const storedSession = localStorage.getItem(storageKey);
      
      let token: string | undefined;
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          token = parsed?.access_token;
        } catch (e) {
          console.error('Failed to parse stored session:', e);
        }
      }
      
      if (!token) {
        throw new Error('Authentication required');
      }

      // Use streaming endpoint for real-time progress
      const url = `${supabase.supabaseUrl}/functions/v1/extract-pdf-stream`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.status}`);
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onProgress?.(data);
              
              if (data.type === 'complete' || data.type === 'error') {
                return data.type === 'complete';
              }
            } catch (e) {
              // Skip invalid JSON
            }
          } else if (line === 'event: done') {
            return true;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Extract PDF text error:', error);
      return false;
    }
  };

  const subscribeToDocumentChanges = (callback: (document: Document) => void) => {
    const subscription = supabase
      .channel('document-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'documents',
      }, (payload) => {
        if (payload.new) {
          callback(payload.new as Document);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  /**
   * Fetch helper for streaming chat completions from the Supabase edge function.
   * Adds required headers and handles Server-Sent Events (SSE) parsing.
   */
  const fetchChatStream = async (
    openaiKey: string,
    messages: { role: string; content: string }[],
    model: string,
    temperature: number,
    onChunk: (chunk: string) => void
  ): Promise<void> => {
    const response = await fetch('/functions/v1/chat-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({ messages, model, temperature }),
    });

    if (!response.ok) {
      console.error(await response.text());
      throw new Error(`Request failed with status ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch {
            /* ignore malformed JSON */
          }
        }
      }
    }
  };

  const sendMessage = async (
    message: string, 
    threadId?: string, 
    documentId?: string,
    onChunk?: (content: string) => void,
    onComplete?: (threadId: string, messageId: string) => void,
    onError?: (error: string) => void
  ): Promise<void> => {
    console.log('🛠️ sendMessage called with:', { message, threadId, documentId });
    console.log('🚨 DEBUGGING: sendMessage function started - timestamp:', Date.now());
    
    try {
      console.log('🔍 [SEND MESSAGE ENTRY] - inside try block');
      
      // Try getting the session from localStorage directly
      console.log('… attempting to get session from localStorage');
      const storageKey = `sb-${supabase.supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
      console.log('Storage key:', storageKey);
      
      const storedSession = localStorage.getItem(storageKey);
      console.log('Stored session exists:', !!storedSession);
      
      let token: string | undefined;
      
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          token = parsed?.access_token;
          console.log('✅ Got token from localStorage:', token?.slice(0,20) + '...');
        } catch (e) {
          console.error('Failed to parse stored session:', e);
        }
      }
      
      if (!token) {
        console.log('⚠️ No token in localStorage, falling back to anon key');
        token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wc3FsYXVtaHp6bHFqdHljcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDAzMzAsImV4cCI6MjA2ODI3NjMzMH0.i_dRSQj_l5bpzHjKMeq58QjWwoa8Y2QikeZrav8-rxo";
      }
      
      console.log('✅ Proceeding to fetch with token');

      // Make direct fetch call for streaming support
      const url = `https://npsqlaumhzzlqjtycpim.supabase.co/functions/v1/chat-stream`;
      console.log('Sending message to:', url);
      console.log('Request body:', { message, threadId, documentId });
      
      console.log('→ about to fetch /chat-stream');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, threadId, documentId }),
      });

      console.log('← fetch returned', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let currentThreadId = threadId;
      let currentMessageId: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            try {
              const parsed = JSON.parse(data);
              
              switch (parsed.type) {
                case 'thread':
                  currentThreadId = parsed.threadId;
                  currentMessageId = parsed.messageId;
                  break;
                case 'content':
                  onChunk?.(parsed.content);
                  break;
                case 'done':
                  if (currentThreadId && currentMessageId) {
                    onComplete?.(currentThreadId, currentMessageId);
                  }
                  return;
                case 'error':
                  onError?.(parsed.error);
                  return;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('💥 sendMessage unexpected error:', error);
      console.error('💥 Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('💥 Error type:', typeof error, error);
      onError?.(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const getThreadMessages = async (threadId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Get thread messages error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Get thread messages error:', error);
      return [];
    }
  };

  const getUserThreads = async () => {
    try {
      const { data, error } = await supabase
        .from('threads')
        .select(`
          *,
          documents(name),
          messages(content, created_at)
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Get user threads error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Get user threads error:', error);
      return [];
    }
  };

  const generateSnapshot = async (documentId: string) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase.functions.invoke('generate-snapshot', {
        body: { documentId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Snapshot generation error:', error);
        throw new Error(error.message || 'Failed to generate snapshot');
      }

      return data;
    } catch (error) {
      console.error('Generate snapshot error:', error);
      throw error;
    }
  };

  return { 
    uploadFile, 
    getDocument, 
    getUserDocuments, 
    deleteDocument, 
    extractPdfText,
    subscribeToDocumentChanges,
    fetchChatStream,
    sendMessage,
    getThreadMessages,
    getUserThreads,
    generateSnapshot
  };
};