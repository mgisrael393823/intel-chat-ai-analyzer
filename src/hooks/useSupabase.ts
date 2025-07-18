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
    try {
      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please sign in to upload files.');
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);

      // Call the upload-pdf edge function
      const { data, error } = await supabase.functions.invoke('upload-pdf', {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

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

  const extractPdfText = async (documentId: string): Promise<boolean> => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase.functions.invoke('extract-pdf-text', {
        body: { documentId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Text extraction error:', error);
        return false;
      }

      return data.success;
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
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      // Make direct fetch call for streaming support
      const url = `https://npsqlaumhzzlqjtycpim.supabase.co/functions/v1/chat-stream`;
      console.log('Sending message to:', url);
      console.log('Request body:', { message, threadId, documentId });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, threadId, documentId }),
      });

      console.log('Response status:', response.status);
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
      console.error('Send message error:', error);
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