import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStopGeneration: () => void;
  isStreaming: boolean;
  disabled: boolean;
  hasUploadedFiles: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStopGeneration,
  isStreaming,
  disabled,
  hasUploadedFiles
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

  return (
    <div className="flex-shrink-0 border-t border-border/50 bg-card/50 backdrop-blur-sm p-2 sm:p-4">
      <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            id="chat-message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasUploadedFiles ? "Ask questions about your documents..." : "Ask a question or upload a document..."}
            disabled={disabled || isStreaming}
            className="resize-none pr-24 min-h-[44px] max-h-[120px] bg-background/50 border-border/50 focus:border-primary/50 transition-colors duration-100"
            maxLength={maxLength}
            autoComplete="off"
          />
          
          <div className="absolute right-2 bottom-2 flex items-center space-x-2">
            {hasUploadedFiles && (
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
                className="h-8 w-8 p-0"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={!message.trim() || disabled || isStreaming}
                className="h-8 w-8 p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
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
      </form>
    </div>
  );
};