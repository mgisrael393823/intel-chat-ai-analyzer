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

  return { 
    uploadFile, 
    getDocument, 
    getUserDocuments, 
    deleteDocument, 
    extractPdfText,
    subscribeToDocumentChanges 
  };
};