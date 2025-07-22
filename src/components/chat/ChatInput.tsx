import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStopGeneration: () => void;
  isStreaming: boolean;
  disabled: boolean;
  hasUploadedFiles: boolean;
  isMobile?: boolean;
  onFileUpload?: (files: File[]) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStopGeneration,
  isStreaming,
  disabled,
  hasUploadedFiles,
  isMobile = false,
  onFileUpload
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxLength = 2000;

  // Use ResizeObserver for more stable height adjustments
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const adjustHeight = () => {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 5 * 24; // 5 lines * approximate line height
      textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    };
    
    // Initial adjustment
    adjustHeight();
    
    // Create ResizeObserver for smooth resizing
    const resizeObserver = new ResizeObserver(adjustHeight);
    resizeObserver.observe(textarea);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      // Keep focus on textarea after sending
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleStop = () => {
    onStopGeneration();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && onFileUpload) {
      const files = Array.from(e.target.files);
      onFileUpload(files);
    }
  };

  return (
    <div className={cn(
      "flex-shrink-0 border-t border-border/50 bg-card/50 backdrop-blur-sm",
      isMobile ? "p-3" : "p-2 sm:p-4"
    )}>
      <form onSubmit={handleSubmit} className={cn(
        isMobile ? "space-y-3" : "space-y-2 sm:space-y-3"
      )}>
        <div className="relative">
          <Textarea
            ref={textareaRef}
            id="chat-message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasUploadedFiles ? "Ask questions about your documents..." : (isMobile ? "Ask a question..." : "Ask a question or upload a document...")}
            disabled={disabled || isStreaming}
            className={cn(
              "resize-none bg-background/50 border-border/50 focus:border-primary/50 transition-colors duration-100",
              isMobile 
                ? "pr-16 min-h-[56px] max-h-[140px] text-base" 
                : "pr-24 min-h-[44px] max-h-[120px]"
            )}
            maxLength={maxLength}
            autoComplete="off"
            style={{ fontSize: isMobile ? '16px' : undefined }} // Prevent iOS zoom
          />
          
          <div className={cn(
            "absolute flex items-center",
            isMobile ? "right-3 bottom-3 space-x-2" : "right-2 bottom-2 space-x-2"
          )}>
            {/* File Upload Button - Only show on mobile when no files uploaded */}
            {isMobile && !hasUploadedFiles && onFileUpload && (
              <>
                <input
                  type="file"
                  id="chat-file-upload"
                  accept=".pdf"
                  multiple
                  onChange={handleFileUpload}
                  className="sr-only"
                  disabled={disabled || isStreaming}
                />
                <label htmlFor="chat-file-upload">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "p-0",
                      isMobile 
                        ? "h-10 w-10 min-w-[48px] min-h-[48px]" 
                        : "h-8 w-8 min-w-[44px] min-h-[44px]"
                    )}
                    asChild
                  >
                    <div className="cursor-pointer flex items-center justify-center">
                      <Paperclip className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                    </div>
                  </Button>
                </label>
              </>
            )}
            {hasUploadedFiles && !isMobile && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                <Paperclip className="h-3 w-3" />
                <span>PDF</span>
              </div>
            )}
            
            {isStreaming ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleStop}
                className={cn(
                  "p-0",
                  isMobile 
                    ? "h-10 w-10 min-w-[48px] min-h-[48px]" 
                    : "h-8 w-8 min-w-[44px] min-h-[44px]"
                )}
              >
                <Square className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={!message.trim() || disabled || isStreaming}
                className={cn(
                  "p-0",
                  isMobile 
                    ? "h-10 w-10 min-w-[48px] min-h-[48px]" 
                    : "h-8 w-8 min-w-[44px] min-h-[44px]"
                )}
              >
                <Send className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
              </Button>
            )}
          </div>
        </div>
        
        {!isMobile && (
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              <span>
                {message.length}/{maxLength}
              </span>
              {hasUploadedFiles && (
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                    {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
                  </kbd>
                  <span>+</span>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd>
                  <span>to send</span>
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Mobile: Show character counter only when approaching limit */}
        {isMobile && message.length > maxLength * 0.8 && (
          <div className="text-center">
            <span className={cn(
              "text-sm",
              message.length > maxLength * 0.9 ? "text-destructive" : "text-muted-foreground"
            )}>
              {message.length}/{maxLength}
            </span>
          </div>
        )}
      </form>
    </div>
  );
};