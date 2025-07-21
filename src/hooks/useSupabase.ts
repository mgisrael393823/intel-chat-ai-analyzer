import { supabase } from '@/integrations/supabase/client';
import authService from '@/services/AuthService';

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
      const session = await authService.getSessionWithTimeout();
      if (!session) {
        throw new Error('Authentication required. Please sign in to upload files.');
      }

      const userId = session.user.id;
      const userEmail = session.user.email;
      
      console.log('👤 Uploading as user:', userEmail);
      
      // Generate unique filename with user ID prefix for organization
      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`;
      
      console.log('⏳ Starting direct upload to Supabase Storage...');
      console.log('📦 Bucket: documents, Path:', fileName);
      
      // Direct upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false // Prevent overwriting existing files
        });
      
      console.log('✅ Direct upload response:', { data: uploadData, error: uploadError });
      
      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw uploadError;
      }
      
      if (!uploadData?.path) {
        throw new Error('Upload succeeded but no file path returned');
      }
      
      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(uploadData.path);
      
      console.log('🔗 Public URL generated:', urlData.publicUrl);
      
      // Create document record in database
      const documentRecord = {
        user_id: userId,
        name: file.name,
        size: file.size,
        type: file.type,
        storage_url: urlData.publicUrl,
        status: 'processing',
        upload_progress: 100
      };
      
      console.log('💾 Creating document record:', documentRecord);
      
      const { data: documentData, error: dbError } = await supabase
        .from('documents')
        .insert(documentRecord)
        .select()
        .single();
      
      if (dbError) {
        console.error('❌ Database error:', dbError);
        // Try to clean up the uploaded file
        await supabase.storage.from('documents').remove([uploadData.path]);
        throw new Error('Failed to save document record: ' + dbError.message);
      }
      
      console.log('✅ Document record created:', documentData);
      
      // Trigger PDF text extraction asynchronously
      // Note: This is fire-and-forget, we don't await it
      extractPdfText(documentData.id).then(success => {
        console.log('📄 PDF extraction completed:', success);
      }).catch(error => {
        console.error('📄 PDF extraction failed:', error);
        // Update document status to error
        supabase
          .from('documents')
          .update({ 
            status: 'error',
            error_message: 'Failed to extract text from PDF'
          })
          .eq('id', documentData.id)
          .then(() => console.log('Updated document status to error'))
          .catch(err => console.error('Failed to update document status:', err));
      });
      
      // Return the document immediately (extraction happens in background)
      return documentData as Document;
    } catch (error) {
      console.error('❌ Upload file error:', error);
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
    onProgress?: (data: unknown) => void
  ): Promise<boolean> => {
    try {
      const session = await authService.getSessionWithTimeout();
      if (!session) {
        throw new Error('Authentication required');
      }
      const token = session.access_token;

      // Call the extract-pdf-text function directly
      const url = `${supabase.supabaseUrl}/functions/v1/extract-pdf-text`;
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

      // Parse the response
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      // Notify progress callback with completion
      if (onProgress) {
        onProgress({
          type: 'complete',
          message: result.message,
          textLength: result.textLength,
          chunks: result.chunks
        });
      }

      return result.success;
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


  const sendMessage = async (
    message: string,
    threadId?: string,
    documentId?: string,
    onChunk?: (content: string) => void,
    onComplete?: (threadId: string, messageId: string) => void,
    onError?: (error: string) => void
  ): Promise<void> => {
    try {
      const session = await authService.getSessionWithTimeout();
      if (!session) {
        onError?.('Please sign in to send messages');
        return;
      }

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/chat-stream`, {
        method: 'POST',
        cache: 'no-cache',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message, threadId, documentId })
      });

      if (!response.ok || !response.body) {
        onError?.(`HTTP ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let currentThreadId = threadId;
      let currentMessageId: string | undefined;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          const dataStr = part.slice(6).trim();
          if (!dataStr) continue;
          if (dataStr === '[DONE]') {
            if (currentThreadId && currentMessageId) {
              onComplete?.(currentThreadId, currentMessageId);
            }
            return;
          }
          try {
            const parsed = JSON.parse(dataStr);
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
              default:
                break;
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (error) {
      console.error('💥 sendMessage unexpected error:', error);
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
      const session = await authService.getSessionWithTimeout();
      if (!session) {
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
    sendMessage,
    getThreadMessages,
    getUserThreads,
    generateSnapshot
  };
};