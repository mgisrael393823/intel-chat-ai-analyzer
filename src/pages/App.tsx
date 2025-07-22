import React, { useState, useEffect, useRef } from 'react';
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
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileTabsWrapper } from '@/components/mobile/MobileTabsWrapper';
import { MobileChatView } from '@/components/mobile/MobileChatView';
import { MobileFileView } from '@/components/mobile/MobileFileView';
import { cn } from '@/lib/utils';
import ErrorBoundary from '@/components/ErrorBoundary';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

const App = () => {
  const { isMobile, isLoading } = useIsMobile();
  const [uploadedDocuments, setUploadedDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>();
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  
  const { 
    uploadFile, 
    getUserDocuments, 
    sendMessage, 
    getThreadMessages,
    subscribeToDocumentChanges,
    deleteDocument 
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
      // Document status update received
      
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
  }, []); // Remove dependencies that cause infinite loops

  const handleFileUpload = async (files: File[]) => {
    // Handle file upload
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
      // Upload failed
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
    // Handle send message
    
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

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

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

        if (error === 'aborted') {
          setMessages(prev => prev.filter(m => m.id !== tempAssistantMessage.id));
          return;
        }

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
      },
      controller.signal
    );
  };

  const handleStopGeneration = () => {
    setIsStreaming(false);
    controllerRef.current?.abort();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };


  const handleDeleteDocument = async (documentId: string) => {
    if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      const success = await deleteDocument(documentId);
      if (success) {
        // Remove from local state
        setUploadedDocuments(prev => prev.filter(doc => doc.id !== documentId));
        
        // Add success message
        const deleteMessage: Message = {
          id: Date.now().toString(),
          content: '🗑️ Document deleted successfully.',
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, deleteMessage]);
      } else {
        throw new Error('Failed to delete document');
      }
    } catch (error) {
      // Delete document error
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const AppContent = () => {
    // Show loading state while determining mobile/desktop
    if (isLoading) {
      return (
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }

    return (
      <div className={cn(
        "flex flex-col bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden",
        isMobile ? "mobile-viewport-height safe-area-top" : "h-screen"
      )}>
        {/* Header */}
        <header className="flex-shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className={cn(
            "mx-auto px-4 py-4",
            isMobile ? "" : "max-w-7xl"
          )}>
            <div className="flex items-center justify-between">
              <Link to="/" className={cn(
                "flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors",
                isMobile ? "min-w-[48px] min-h-[48px]" : "min-w-[44px] min-h-[44px]"
              )}>
                <ArrowLeft className="w-4 h-4" />
                {!isMobile && <span className="hidden sm:inline">Back to Home</span>}
                {isMobile && <span className="text-sm">Back</span>}
              </Link>
              <h1 className={cn(
                "font-semibold text-foreground",
                isMobile ? "text-lg" : "text-lg sm:text-xl"
              )}>
                {isMobile ? "Chat" : "OM Intel Chat"}
              </h1>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSignOut}
                className={cn(
                  "flex items-center gap-2",
                  isMobile ? "min-w-[48px] min-h-[48px]" : "min-w-[44px] min-h-[44px]"
                )}
              >
                <LogOut className="w-4 h-4" />
                {!isMobile && <span className="hidden sm:inline">Sign Out</span>}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {isMobile ? (
            // Mobile Layout with Tabs
            <>
              <MobileTabsWrapper
                chatContent={
                  <MobileChatView
                    messages={messages}
                    isStreaming={isStreaming}
                    isUploading={isUploading}
                    hasUploadedFiles={uploadedDocuments.length > 0}
                    onSendMessage={handleSendMessage}
                    onStopGeneration={handleStopGeneration}
                    onFileUpload={handleFileUpload}
                  />
                }
                filesContent={
                  <MobileFileView
                    onFileUpload={handleFileUpload}
                    onFileDelete={handleDeleteDocument}
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
                }
                uploadedFilesCount={uploadedDocuments.length}
                processingFilesCount={uploadedDocuments.filter(doc => doc.status === 'processing').length}
              />
            </>
          ) : (
            // Desktop Layout (existing)
            <div className="h-full max-w-7xl mx-auto p-4">
              <div className="h-full flex flex-col lg:flex-row gap-4">
                {/* Left Column - File Upload */}
                <aside className="w-full lg:w-1/3 xl:w-2/5 max-w-md h-full lg:h-auto overflow-y-auto">
                  <FileUploadZone
                    onFileUpload={handleFileUpload}
                    onFileDelete={handleDeleteDocument}
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
                </aside>

                {/* Right Column - Chat Interface */}
                <div className="flex-1 h-full min-h-[400px] lg:min-h-0 flex flex-col bg-card/30 backdrop-blur-sm rounded-lg border border-border/50 shadow-lg overflow-hidden">
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
          )}
        </main>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <AppContent />
      </ProtectedRoute>
    </ErrorBoundary>
  );
};

export default App;