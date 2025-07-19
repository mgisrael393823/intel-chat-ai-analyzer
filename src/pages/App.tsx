import React, { useState, useEffect } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FileUploadZone } from '@/components/chat/FileUploadZone';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { Message } from '@/components/chat/ChatMessage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSupabase, Document } from '@/hooks/useSupabase';
import ErrorBoundary from '@/components/ErrorBoundary';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

const App = () => {
  const [uploadedDocuments, setUploadedDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>();
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  
  const { 
    uploadFile, 
    getUserDocuments, 
    sendMessage, 
    getThreadMessages,
    subscribeToDocumentChanges,
    extractPdfText
  } = useSupabase();

  // Load user documents on mount
  useEffect(() => {
    const loadDocuments = async () => {
      const docs = await getUserDocuments();
      setUploadedDocuments(docs);
      
      // Add welcome message if user has documents
      if (docs.length > 0 && messages.length === 0) {
        const welcomeMessage: Message = {
          id: 'welcome',
          content: `Welcome! I can see you have ${docs.length} document(s) uploaded. Ask me questions about your commercial real estate deals, such as:\n\n• What are the key financial metrics?\n• What's the property type and location?\n• What are the investment risks and opportunities?`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    };
    
    loadDocuments();
  }, []);

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (const file of files) {
        console.log('📄 Uploading file:', file.name);
        const document = await uploadFile(file);
        setUploadedDocuments(prev => [...prev, document]);
        
        // Add upload success message
        const uploadMessage: Message = {
          id: Date.now().toString(),
          content: `✅ Uploaded "${document.name}" successfully! Starting text extraction...`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, uploadMessage]);

        // Start PDF text extraction automatically
        console.log('🔄 Starting PDF text extraction for:', document.id);
        try {
          const extractionSuccess = await extractPdfText(document.id);
          
          if (extractionSuccess) {
            console.log('✅ PDF text extraction completed');
            // Update document status in local state
            setUploadedDocuments(prev => 
              prev.map(doc => 
                doc.id === document.id 
                  ? { ...doc, status: 'ready' }
                  : doc
              )
            );
            
            // Add extraction success message
            const readyMessage: Message = {
              id: (Date.now() + 1).toString(),
              content: `🎉 Perfect! "${document.name}" has been processed and is ready for analysis. Ask me anything about this offering memorandum!`,
              role: 'assistant',
              timestamp: new Date()
            };
            setMessages(prev => [...prev, readyMessage]);
          } else {
            console.error('❌ PDF text extraction failed');
            // Add extraction failure message
            const errorMessage: Message = {
              id: (Date.now() + 1).toString(),
              content: `⚠️ I uploaded "${document.name}" but had trouble extracting the text. You can still try asking questions, but I might not have full access to the document content.`,
              role: 'assistant',
              timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
          }
        } catch (extractError) {
          console.error('❌ PDF extraction error:', extractError);
          const extractErrorMessage: Message = {
            id: (Date.now() + 2).toString(),
            content: `❌ There was an error processing "${document.name}": ${extractError instanceof Error ? extractError.message : 'Unknown error'}`,
            role: 'assistant',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, extractErrorMessage]);
        }
      }
      
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `Sorry, there was an error uploading your file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleSendMessage = async (content: string) => {
    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Create temporary assistant message for streaming (but don't start streaming state yet)
    const tempAssistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      status: 'pending' // Start as pending, not streaming
    };
    setMessages(prev => [...prev, tempAssistantMessage]);

    // Get the most recent document for context
    const documentId = uploadedDocuments.length > 0 ? uploadedDocuments[0].id : undefined;

    let streamStarted = false;

    await sendMessage(
      content,
      currentThreadId,
      documentId,
      // onStreamStart - called when streaming actually begins
      () => {
        if (!streamStarted) {
          streamStarted = true;
          console.log('🌊 Stream started - setting isStreaming to true');
          setIsStreaming(true);
          setStreamingMessage('');
          // Update message status to streaming
          setMessages(prevMessages => 
            prevMessages.map(msg => 
              msg.id === tempAssistantMessage.id 
                ? { ...msg, status: 'streaming' }
                : msg
            )
          );
        }
      },
      // onChunk - append streaming content
      (chunk: string) => {
        console.log('📝 Received chunk:', chunk);
        setStreamingMessage(prev => prev + chunk);
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === tempAssistantMessage.id 
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      },
      // onComplete - finalize message
      (threadId: string, messageId: string) => {
        console.log('✅ Stream completed');
        setCurrentThreadId(threadId);
        setIsStreaming(false);
        setStreamingMessage('');
        
        // Update the message with final status
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === tempAssistantMessage.id 
              ? { ...msg, status: 'sent' }
              : msg
          )
        );
      },
      // onError - handle errors
      (error: string) => {
        console.error('❌ Stream error:', error);
        setIsStreaming(false);
        setStreamingMessage('');
        
        // Replace streaming message with error
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === tempAssistantMessage.id 
              ? { 
                  ...msg, 
                  content: `Sorry, I encountered an error: ${error}`, 
                  status: 'error' 
                }
              : msg
          )
        );
      }
    );
  };

  const handleStopGeneration = () => {
    setIsStreaming(false);
    // TODO: Implement actual stream cancellation
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
              uploadedFiles={uploadedDocuments.map(doc => ({
                id: doc.id,
                name: doc.name,
                size: doc.size,
                type: doc.type,
              }))}
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
              hasUploadedFiles={uploadedDocuments.length > 0}
            />
          </div>
        </div>
      </div>

      {/* Mobile responsive handled by Tailwind classes */}
    </div>
  );

  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <AppContent />
      </ProtectedRoute>
    </ErrorBoundary>
  );
};

export default App;