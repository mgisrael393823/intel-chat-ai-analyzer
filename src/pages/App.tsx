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
    subscribeToDocumentChanges 
  } = useSupabase();

  // Load user documents on mount and subscribe to changes
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
    
    // Subscribe to document status changes for real-time updates
    const unsubscribe = subscribeToDocumentChanges((updatedDoc) => {
      console.log('📄 Document status update:', updatedDoc);
      
      setUploadedDocuments(prev => 
        prev.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc)
      );
      
      // Add status message based on document status
      if (updatedDoc.status === 'ready') {
        const readyMessage: Message = {
          id: `doc-ready-${updatedDoc.id}`,
          content: `✅ "${updatedDoc.name}" has been processed successfully! I've extracted the text and I'm ready to answer your questions about this offering memorandum.`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, readyMessage]);
      } else if (updatedDoc.status === 'error') {
        const errorMessage: Message = {
          id: `doc-error-${updatedDoc.id}`,
          content: `⚠️ I had trouble processing "${updatedDoc.name}". ${updatedDoc.error_message || 'Please try uploading again.'}`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [messages.length, subscribeToDocumentChanges, getUserDocuments]);

  const handleFileUpload = async (files: File[]) => {
    console.log('▶️ handleFileUpload called with files:', files.map(f => ({ name: f.name, size: f.size, type: f.type })));
    if (files.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (const file of files) {
        const document = await uploadFile(file);
        setUploadedDocuments(prev => [...prev, document]);
        
        // Add success message
        const successMessage: Message = {
          id: Date.now().toString(),
          content: `✅ Upload complete for "${document.name}"! I'm now processing the PDF to extract text. This usually takes 15-30 seconds. You'll see the status update in the file list.`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);
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
    console.log('🎯 App.handleSendMessage called with:', content);
    
    // Add user message immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Start streaming
    setIsStreaming(true);
    setStreamingMessage('');

    // Create temporary assistant message for streaming
    const tempAssistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      status: 'streaming'
    };
    setMessages(prev => [...prev, tempAssistantMessage]);

    // Get the most recent document for context
    const documentId = uploadedDocuments.length > 0 ? uploadedDocuments[0].id : undefined;

    await sendMessage(
      content,
      currentThreadId,
      documentId,
      // onChunk - append streaming content
      (chunk: string) => {
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
                status: doc.status,
                error_message: doc.error_message,
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