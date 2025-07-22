import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage, Message } from './ChatMessage';
import { Button } from '@/components/ui/button';

interface ChatMessagesProps {
  messages: Message[];
  isStreaming: boolean;
}

export const ChatMessages: React.FC<ChatMessagesProps> = React.memo(({ messages, isStreaming }) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // Simple auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-scroll when messages change, unless user is scrolling
  useEffect(() => {
    if (!isUserScrolling) {
      scrollToBottom();
    }
  }, [messages, isUserScrolling, scrollToBottom]);

  // Detect user scrolling
  useEffect(() => {
    if (!scrollAreaRef.current) return;
    
    const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollElement) return;
    
    const handleScroll = () => {
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      const scrollTop = scrollElement.scrollTop;
      const scrollHeight = scrollElement.scrollHeight;
      const clientHeight = scrollElement.clientHeight;
      
      // Check if at bottom (within 50px)
      const isAtBottom = scrollTop >= scrollHeight - clientHeight - 50;
      
      if (!isAtBottom) {
        setIsUserScrolling(true);
        // Reset after user stops scrolling for 3 seconds
        scrollTimeoutRef.current = setTimeout(() => {
          setIsUserScrolling(false);
        }, 3000);
      } else {
        setIsUserScrolling(false);
      }
    };
    
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground">Ready to Analyze</h3>
          <p className="text-muted-foreground">
            Upload a document and start asking questions about your offering memorandum.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative min-h-0">
      <ScrollArea ref={scrollAreaRef} className="h-full w-full">
        <div className="p-4 space-y-1 scroll-smooth">
          {messages.map((message, index) => (
            <div key={message.id}>
              <ChatMessage 
                message={message} 
                isLatest={index === messages.length - 1}
              />
            </div>
          ))}
          
          {isStreaming && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/50 rounded-lg px-4 py-3 shadow-sm backdrop-blur-sm">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-muted-foreground">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Invisible div to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      {/* Show scroll to bottom button when user has scrolled up */}
      {isUserScrolling && (
        <div className="absolute bottom-4 right-4">
          <Button
            onClick={scrollToBottom}
            size="sm"
            className="rounded-full shadow-lg"
            aria-label="Scroll to bottom"
          >
            ↓ New messages
          </Button>
        </div>
      )}
    </div>
  );
});