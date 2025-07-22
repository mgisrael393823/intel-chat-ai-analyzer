import React, { useCallback, useState } from 'react';
import { Upload, File, X, BarChart3, CheckCircle, AlertCircle, Loader2, Camera, FolderOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSupabase } from '@/hooks/useSupabase';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
  status?: 'uploading' | 'processing' | 'ready' | 'error';
  error_message?: string;
}

interface MobileFileViewProps {
  onFileUpload: (files: File[]) => void;
  onFileDelete?: (fileId: string) => void;
  uploadedFiles: UploadedFile[];
  isUploading: boolean;
  uploadProgress: number;
}

export const MobileFileView: React.FC<MobileFileViewProps> = ({
  onFileUpload,
  onFileDelete,
  uploadedFiles,
  isUploading,
  uploadProgress
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [generatingSnapshot, setGeneratingSnapshot] = useState<string | null>(null);
  const { generateSnapshot } = useSupabase();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFiles = (files: File[]) => {
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    if (pdfFiles.length > 0) {
      onFileUpload(pdfFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (fileId: string) => {
    if (onFileDelete) {
      onFileDelete(fileId);
    }
  };

  const handleGenerateSnapshot = async (fileId: string) => {
    setGeneratingSnapshot(fileId);
    try {
      const result = await generateSnapshot(fileId);
      alert(`Snapshot generated for ${result.documentName}!\n\nProperty: ${result.snapshot.propertyName}\nPrice: $${result.snapshot.askingPrice?.toLocaleString() || 'N/A'}\nCap Rate: ${result.snapshot.capRate || 'N/A'}%`);
    } catch (error) {
      alert(`Failed to generate snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingSnapshot(null);
    }
  };

  if (uploadedFiles.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Empty State with Mobile Upload */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
            <FolderOpen className="w-10 h-10 text-primary" />
          </div>
          
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No Documents Yet
          </h3>
          <p className="text-muted-foreground mb-8 max-w-sm">
            Upload a PDF offering memorandum to start analyzing and asking questions about your commercial real estate deals.
          </p>
          
          {/* Mobile Upload Buttons */}
          <div className="w-full max-w-sm space-y-3">
            <div className="relative">
              <input
                type="file"
                id="mobile-pdf-upload"
                name="mobile-pdf-upload"
                accept=".pdf"
                multiple
                onChange={handleFileInput}
                className="sr-only"
                disabled={isUploading}
              />
              <label
                htmlFor="mobile-pdf-upload"
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-primary text-primary-foreground rounded-lg font-medium text-base min-h-[56px] cursor-pointer hover:bg-primary/90 transition-colors"
              >
                <Upload className="h-5 w-5" />
                Choose PDF Files
              </label>
            </div>
            
            <div className="relative">
              <input
                type="file"
                id="mobile-camera-upload"
                name="mobile-camera-upload"
                accept="image/*,.pdf"
                capture="environment"
                onChange={handleFileInput}
                className="sr-only"
                disabled={isUploading}
              />
              <label
                htmlFor="mobile-camera-upload"
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-secondary text-secondary-foreground rounded-lg font-medium text-base min-h-[56px] cursor-pointer hover:bg-secondary/80 transition-colors"
              >
                <Camera className="h-5 w-5" />
                Scan Document
              </label>
            </div>
          </div>
          
          {isUploading && (
            <div className="w-full max-w-sm mt-6">
              <div className="bg-muted rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with Upload Button */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border/50">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Documents</h2>
          <p className="text-sm text-muted-foreground">
            {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} uploaded
          </p>
        </div>
        
        <div className="relative">
          <input
            type="file"
            id="mobile-add-pdf"
            name="mobile-add-pdf"
            accept=".pdf"
            multiple
            onChange={handleFileInput}
            className="sr-only"
            disabled={isUploading}
          />
          <label
            htmlFor="mobile-add-pdf"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm min-h-[44px] cursor-pointer hover:bg-primary/90 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Add PDF
          </label>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {uploadedFiles.map((file) => (
          <Card key={file.id} className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="relative inline-block flex-shrink-0">
                  <File className="h-8 w-8 text-primary" />
                  <div className="absolute -bottom-1 -right-1 pointer-events-none">
                    {file.status === 'processing' && (
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    )}
                    {file.status === 'ready' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-foreground mb-1 break-all">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                    {file.status && (
                      <span className={cn(
                        'text-sm font-medium',
                        file.status === 'processing' ? 'text-blue-500' :
                        file.status === 'ready' ? 'text-green-500' :
                        file.status === 'error' ? 'text-red-500' :
                        'text-muted-foreground'
                      )}>
                        {file.status === 'processing' ? 'Processing...' :
                         file.status === 'ready' ? 'Ready' :
                         file.status === 'error' ? 'Error' :
                         'Uploading...'}
                      </span>
                    )}
                  </div>
                  
                  {file.status === 'error' && file.error_message && (
                    <p className="text-sm text-red-500 mb-3">{file.error_message}</p>
                  )}
                  
                  {/* Mobile Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateSnapshot(file.id)}
                      disabled={generatingSnapshot === file.id || file.status !== 'ready'}
                      className="flex-1 min-h-[44px]"
                    >
                      {generatingSnapshot === file.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Generate Snapshot
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="min-w-[44px] min-h-[44px]"
                      aria-label="Delete document"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Upload Progress at bottom if uploading */}
      {isUploading && (
        <div className="flex-shrink-0 p-4 border-t border-border/50 bg-card/50">
          <div className="bg-muted rounded-full h-3 overflow-hidden mb-2">
            <div 
              className="bg-primary h-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Uploading... {uploadProgress}%
          </p>
        </div>
      )}
    </div>
  );
};