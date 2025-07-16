import { supabase } from '@/integrations/supabase/client';

export const useSupabase = () => {
  const uploadFile = async (file: File) => {
    // Placeholder for Claude Code implementation
    console.log('Upload file:', file.name);
  };

  const getDocument = async (id: string) => {
    // Placeholder for Claude Code implementation
    console.log('Get document:', id);
  };

  return { uploadFile, getDocument };
};