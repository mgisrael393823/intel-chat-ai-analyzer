import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import debounce from 'lodash.debounce';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage, Message } from './ChatMessage';
import { Separator } from '@/components/ui/separator';

interface ChatMessagesProps {
  messages: Message[];
  isStreaming: boolean;
}

export const ChatMessages: React.FC<ChatMessagesProps> = React.memo(({ messages, isStreaming }) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showNewMessageDivider, setShowNewMessageDivider] = useState(false);
  const [lastScrollTop, setLastScrollTop] = useState(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        const isNearBottom = scrollElement.scrollTop > lastScrollTop || 
                            scrollElement.scrollTop >= scrollElement.scrollHeight - scrollElement.clientHeight - 100;
        
        if (isNearBottom) {
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
          setShowNewMessageDivider(false);
        } else {
          setShowNewMessageDivider(true);
        }
      }
    }
  }, [messages]); // Remove lastScrollTop to prevent loops

  const handleScroll = useMemo(
    () => debounce((e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const scrollTop = target.scrollTop;
      setLastScrollTop(scrollTop);
      
      const isAtBottom = scrollTop >= target.scrollHeight - target.clientHeight - 10;
      setShowNewMessageDivider(!isAtBottom && messages.length > 0);
    }, 100),
    [messages.length]
  );

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: 'smooth'
        });
        setShowNewMessageDivider(false);
      }
    }
  };

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
    <div className="flex-1 relative">
      <ScrollArea ref={scrollAreaRef} className="h-full">
        <div className="p-4 space-y-1" onScroll={handleScroll}>
          {messages.map((message, index) => (
            <div key={message.id}>
              <ChatMessage 
                message={message} 
                isLatest={index === messages.length - 1}
              />
              
              {/* New messages divider */}
              {showNewMessageDivider && index === messages.length - 2 && (
                <div className="relative my-4">
                  <Separator />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3">
                    <button 
                      onClick={scrollToBottom}
                      className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
                    >
                      New messages ↓
                    </button>
                  </div>
                </div>
              )}
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
        </div>
      </ScrollArea>
    </div>
  );
});