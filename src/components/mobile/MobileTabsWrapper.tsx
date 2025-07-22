import React, { useState } from 'react';
import { MessageSquare, FolderOpen, Upload } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileTabsWrapperProps {
  // Chat related props
  chatContent: React.ReactNode;
  
  // Files related props
  filesContent: React.ReactNode;
  uploadedFilesCount: number;
  processingFilesCount: number;
}

export const MobileTabsWrapper: React.FC<MobileTabsWrapperProps> = ({
  chatContent,
  filesContent,
  uploadedFilesCount,
  processingFilesCount
}) => {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        {/* Tab Content - Takes all available space */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="chat" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
            {chatContent}
          </TabsContent>
          
          <TabsContent value="files" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col overflow-y-auto">
            <div className="flex-1 p-4">
              {filesContent}
            </div>
          </TabsContent>
        </div>

        {/* Bottom Navigation - Fixed at bottom with safe area */}
        <div className="flex-shrink-0 border-t border-border/50 bg-card/95 backdrop-blur-sm safe-area-bottom">
          <TabsList className="w-full h-auto p-2 bg-transparent grid grid-cols-2 gap-2">
            <TabsTrigger 
              value="chat" 
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-1 px-4 py-3 min-h-[60px] rounded-lg transition-all",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                "data-[state=inactive]:hover:bg-muted/50"
              )}
            >
              <MessageSquare className="h-5 w-5" />
              <span className="text-xs font-medium">Chat</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="files" 
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-1 px-4 py-3 min-h-[60px] rounded-lg transition-all",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                "data-[state=inactive]:hover:bg-muted/50"
              )}
            >
              <div className="relative">
                <FolderOpen className="h-5 w-5" />
                {(uploadedFilesCount > 0 || processingFilesCount > 0) && (
                  <Badge 
                    variant={processingFilesCount > 0 ? "destructive" : "default"}
                    className="absolute -top-2 -right-2 h-4 w-4 p-0 text-[10px] flex items-center justify-center min-w-[16px]"
                  >
                    {processingFilesCount > 0 ? processingFilesCount : uploadedFilesCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">
                Files {uploadedFilesCount > 0 && `(${uploadedFilesCount})`}
              </span>
            </TabsTrigger>
          </TabsList>
          
        </div>
      </Tabs>
    </div>
  );
};