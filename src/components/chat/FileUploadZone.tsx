import React, { useCallback, useState, memo } from 'react';
import { Upload, File, X, BarChart3, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

interface FileUploadZoneProps {
  onFileUpload: (files: File[]) => void;
  onFileDelete?: (fileId: string) => void;
  uploadedFiles: UploadedFile[];
  isUploading: boolean;
  uploadProgress: number;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = memo(({
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
    // Filter for PDF files only
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== files.length) {
      // Show error for non-PDF files
      // Only PDF files are allowed
    }
    
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
      // Snapshot generated successfully
      // TODO: Display snapshot in UI or open modal
      alert(`Snapshot generated for ${result.documentName}!\n\nProperty: ${result.snapshot.propertyName}\nPrice: $${result.snapshot.askingPrice?.toLocaleString() || 'N/A'}\nCap Rate: ${result.snapshot.capRate || 'N/A'}%`);
    } catch (error) {
      // Failed to generate snapshot
      alert(`Failed to generate snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGeneratingSnapshot(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <Card className="border-dashed border-2 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div
            className={cn(
              'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-100',
              isDragOver
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="pdf-upload"
              name="pdf-upload"
              accept=".pdf"
              multiple
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
              aria-label="Upload PDF files"
            />
            
            <Upload className={cn(
              'mx-auto h-12 w-12 mb-4 transition-colors duration-200',
              isDragOver ? 'text-primary' : 'text-muted-foreground'
            )} />
            
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Drop your PDF here
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Or click to browse and select your offering memorandum
            </p>
            <Button variant="outline" disabled={isUploading}>
              Choose Files
            </Button>
            
            {isUploading && (
              <div className="mt-4">
                <div className="bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4">
            <h4 className="font-medium text-foreground mb-3">Uploaded Documents</h4>
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <File className="h-5 w-5 text-primary" />
                      {file.status === 'processing' && (
                        <Loader2 className="h-3 w-3 absolute -bottom-1 -right-1 text-blue-500 animate-spin" />
                      )}
                      {file.status === 'ready' && (
                        <CheckCircle className="h-3 w-3 absolute -bottom-1 -right-1 text-green-500" />
                      )}
                      {file.status === 'error' && (
                        <AlertCircle className="h-3 w-3 absolute -bottom-1 -right-1 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                        {file.status && (
                          <span className={cn(
                            'text-xs',
                            file.status === 'processing' ? 'text-blue-500' :
                            file.status === 'ready' ? 'text-green-500' :
                            file.status === 'error' ? 'text-red-500' :
                            'text-muted-foreground'
                          )}>
                            • {file.status === 'processing' ? 'Processing...' :
                               file.status === 'ready' ? 'Ready' :
                               file.status === 'error' ? 'Error' :
                               'Uploading...'}
                          </span>
                        )}
                      </div>
                      {file.status === 'error' && file.error_message && (
                        <p className="text-xs text-red-500 mt-1">{file.error_message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateSnapshot(file.id)}
                      disabled={generatingSnapshot === file.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 h-7"
                    >
                      {generatingSnapshot === file.id ? (
                        <>
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <BarChart3 className="h-3 w-3 mr-1" />
                          Snapshot
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Preview */}
      {uploadedFiles.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4">
            <h4 className="font-medium text-foreground mb-3">Document Preview</h4>
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <p className="text-sm text-muted-foreground italic">
                {uploadedFiles[0]?.preview || 'Processing document...'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});