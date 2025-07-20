import React from 'react';
import { Progress } from '@/components/ui/progress';
import { FileText, CheckCircle, AlertCircle } from 'lucide-react';

interface ExtractionProgressProps {
  documentName: string;
  currentPage: number;
  totalPages: number;
  progress: number;
  status: 'processing' | 'complete' | 'error';
  keywordsFound: string[];
  message?: string;
}

export const ExtractionProgress: React.FC<ExtractionProgressProps> = ({
  documentName,
  currentPage,
  totalPages,
  progress,
  status,
  keywordsFound,
  message
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500 animate-pulse" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'complete':
        return 'Extraction complete!';
      case 'error':
        return message || 'Extraction failed';
      default:
        return `Processing page ${currentPage} of ${totalPages}...`;
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-sm">{documentName}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {progress}% complete
        </span>
      </div>

      <Progress value={progress} className="h-2" />
      
      <div className="text-xs text-muted-foreground">
        {getStatusText()}
      </div>

      {keywordsFound.length > 0 && status === 'processing' && (
        <div className="flex flex-wrap gap-1 mt-2">
          <span className="text-xs text-muted-foreground">Found:</span>
          {keywordsFound.map((keyword, index) => (
            <span
              key={index}
              className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};