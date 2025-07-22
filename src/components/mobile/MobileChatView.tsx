import React from 'react';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { Message } from '@/components/chat/ChatMessage';

interface MobileChatViewProps {
  messages: Message[];
  isStreaming: boolean;
  isUploading: boolean;
  hasUploadedFiles: boolean;
  onSendMessage: (message: string) => void;
  onStopGeneration: () => void;
  onFileUpload?: (files: File[]) => void;
}

export const MobileChatView: React.FC<MobileChatViewProps> = ({
  messages,
  isStreaming,
  isUploading,
  hasUploadedFiles,
  onSendMessage,
  onStopGeneration,
  onFileUpload
}) => {
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Chat Messages - Full screen area with proper height constraints */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatMessages
          messages={messages}
          isStreaming={isStreaming}
        />
      </div>
      
      {/* Mobile Chat Input - Enhanced for touch */}
      <div className="flex-shrink-0">
        <ChatInput
          onSendMessage={onSendMessage}
          onStopGeneration={onStopGeneration}
          isStreaming={isStreaming}
          disabled={isUploading}
          hasUploadedFiles={hasUploadedFiles}
          isMobile={true}
          onFileUpload={onFileUpload}
        />
      </div>
    </div>
  );
};