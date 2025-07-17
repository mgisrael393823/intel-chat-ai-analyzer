import React, { useState } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FileUploadZone } from '@/components/chat/FileUploadZone';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { Message } from '@/components/chat/ChatMessage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

const App = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);

  const handleFileUpload = (files: UploadedFile[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setUploadedFiles(files);
          
          // Add welcome message when first file is uploaded
          if (files.length > 0 && messages.length === 0) {
            const welcomeMessage: Message = {
              id: Date.now().toString(),
              content: `Great! I've analyzed your document "${files[0].name}". You can now ask me questions about this offering memorandum. For example:\n\n• What's the property type and location?\n• What are the key financial metrics?\n• What's the investment strategy?`,
              role: 'assistant',
              timestamp: new Date()
            };
            setMessages([welcomeMessage]);
          }
          
          return 0;
        }
        return prev + 10;
      });
    }, 100);
  };

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Based on the document you uploaded, here's my analysis of your question:\n\n${content}\n\nThis is a simulated response. In a real implementation, I would analyze the actual PDF content and provide specific insights about the commercial real estate deal, including financial metrics, property details, market analysis, and investment recommendations.`,
        role: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsStreaming(false);
    }, 2000);
  };

  const handleStopGeneration = () => {
    setIsStreaming(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const AppContent = () => (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
            <h1 className="text-xl font-semibold text-foreground">OM Intel Chat</h1>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="h-[calc(100vh-73px)] max-w-7xl mx-auto p-4">
        <div className="h-full flex flex-col md:flex-row gap-6">
          {/* Left Column - File Upload */}
          <div className="w-full md:w-[30%] md:min-w-[350px]">
            <FileUploadZone
              onFileUpload={handleFileUpload}
              uploadedFiles={uploadedFiles}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
            />
          </div>

          {/* Right Column - Chat Interface */}
          <div className="flex-1 flex flex-col bg-card/30 backdrop-blur-sm rounded-lg border border-border/50 shadow-lg overflow-hidden">
            <ChatMessages
              messages={messages}
              isStreaming={isStreaming}
            />
            
            <ChatInput
              onSendMessage={handleSendMessage}
              onStopGeneration={handleStopGeneration}
              isStreaming={isStreaming}
              disabled={isUploading}
              hasUploadedFiles={uploadedFiles.length > 0}
            />
          </div>
        </div>
      </div>

      {/* Mobile responsive handled by Tailwind classes */}
    </div>
  );

  return (
    <ProtectedRoute>
      <AppContent />
    </ProtectedRoute>
  );
};

export default App;