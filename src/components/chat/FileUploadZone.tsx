import React, { useCallback, useState, memo } from 'react';
import { Upload, File, X, BarChart3, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  const [loading, setLoading] = useState(false);
  const [generatingSnapshot, setGeneratingSnapshot] = useState<string | null>(null);
  const [snapshotModalContent, setSnapshotModalContent] = useState<string | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
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
    void handleFiles(files);
  }, []);

  const handleFiles = async (files: File[]) => {
    setLoading(true);
    // Filter for PDF files only
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== files.length) {
      // Show error for non-PDF files
      // Only PDF files are allowed
    }
    
    if (pdfFiles.length > 0) {
      await onFileUpload(pdfFiles);
    }
    setLoading(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      void handleFiles(Array.from(e.target.files));
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
      setSnapshotModalContent(
        `Snapshot for ${result.documentName}\n\nProperty: ${result.snapshot.propertyName}\nPrice: $${result.snapshot.askingPrice?.toLocaleString() || 'N/A'}\nCap Rate: ${result.snapshot.capRate || 'N/A'}%`
      );
      setShowSnapshotModal(true);
    } catch (error) {
      setSnapshotModalContent(
        `Failed to generate snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setShowSnapshotModal(true);
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
            <label htmlFor="pdf-upload" className="absolute inset-0 w-full h-full cursor-pointer" aria-label="Upload PDF files">
              <input
                type="file"
                id="pdf-upload"
                name="pdf-upload"
                accept=".pdf"
                multiple
                onChange={handleFileInput}
                className="sr-only"
                disabled={isUploading}
              />
            </label>
            
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
            <Button variant="outline" disabled={isUploading || loading}>
              {loading ? 'Processing...' : 'Choose Files'}
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
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="relative inline-block flex-shrink-0">
                      <File className="h-5 w-5 text-primary" />
                      <div className="absolute -bottom-1 -right-1 pointer-events-none">
                        {file.status === 'processing' && (
                          <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                        )}
                        {file.status === 'ready' && (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        )}
                        {file.status === 'error' && (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm font-medium text-foreground truncate">
                            {file.name}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="break-all">{file.name}</p>
                        </TooltipContent>
                      </Tooltip>
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateSnapshot(file.id)}
                          disabled={generatingSnapshot === file.id || file.status !== 'ready'}
                          className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity text-xs px-2 py-1 h-7 min-w-[44px]"
                          style={{ zIndex: 'var(--z-dropdown)' }}
                        >
                          {generatingSnapshot === file.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                              <span className="hidden sm:inline">Analyzing...</span>
                            </>
                          ) : (
                            <>
                              <BarChart3 className="h-3 w-3 sm:mr-1" />
                              <span className="hidden sm:inline">Snapshot</span>
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Generate AI snapshot of this document</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity min-w-[44px] min-h-[44px]"
                          aria-label="Delete document"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>Delete document</p>
                      </TooltipContent>
                    </Tooltip>
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

      {showSnapshotModal && (
        <Dialog open={showSnapshotModal} onOpenChange={setShowSnapshotModal}>
          <DialogContent>
            <pre className="whitespace-pre-wrap text-sm">
              {snapshotModalContent}
            </pre>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
});