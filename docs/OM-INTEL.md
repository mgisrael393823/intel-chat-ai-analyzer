
# OM Intel Chat - Project Briefing for Claude Code (UPDATED)

## Project Overview

I'm building **OM Intel Chat**, an AI-powered commercial real estate (CRE) offering memorandum (OM) analyzer. The app extracts key deal metrics, summarizes investment highlights, identifies risks, and enables chat-based Q&A using OpenAI's streaming API.

## Current Implementation Status

### ✅ COMPLETED (UI Layer in Lovable)
- **COMPLETED**: Landing page with pricing tiers (Free: 5 uploads/month, Pro: $49/month unlimited)
- **COMPLETED**: 2-column chat interface (30/70 split) with responsive mobile design
- **COMPLETED**: Drag-and-drop PDF upload with progress indicators and file validation
- **COMPLETED**: Chat components with streaming support and typing indicators
- **COMPLETED**: Professional finance/real estate design system with glassmorphism effects
- **COMPLETED**: Mobile responsive layouts with Tailwind CSS
- **COMPLETED**: All shadcn/ui components integrated (Card, Button, Textarea, ScrollArea, Avatar)
- **COMPLETED**: TypeScript interfaces for Message, Document, Thread, and DealSnapshot
- **COMPLETED**: Supabase client setup with project connection
- **COMPLETED**: React Router setup with Landing and App pages
- **COMPLETED**: Dependencies installed: react-dropzone, react-markdown, @supabase/supabase-js
- **COMPLETED**: Placeholder Supabase hook (useSupabase.ts) ready for implementation

### 🔧 Needs Implementation (Backend in Claude Code)
- Supabase Storage for PDF uploads (bucket creation and RLS policies)
- PDF text extraction and chunking (Edge Functions)
- OpenAI streaming chat integration (needs OPENAI_API_KEY secret)
- Database schema for thread persistence
- Authentication with Supabase Auth
- Stripe payment integration
- Usage tracking and plan enforcement

## Tech Stack

```
Frontend (✅ COMPLETED):
- React + TypeScript (Vite)
- Tailwind CSS + shadcn/ui
- react-router-dom for routing
- react-dropzone for file uploads
- react-markdown for message rendering

Backend (To Implement):
- Supabase (Database, Auth, Storage)
- OpenAI API (chat.completions with streaming)
- Stripe (Subscriptions)
- Edge Functions (PDF processing)
```

## Project Structure (✅ COMPLETED)

```
src/
├── components/
│   ├── chat/
│   │   ├── ChatInput.tsx        # ✅ Auto-expanding textarea with send/stop button
│   │   ├── ChatMessage.tsx      # ✅ User/assistant message bubbles with avatars
│   │   ├── ChatMessages.tsx     # ✅ Scrollable list with typing indicators
│   │   └── FileUploadZone.tsx   # ✅ Drag-drop with progress and file list
│   ├── landing/                 # ✅ Complete landing page components
│   └── ui/                      # ✅ shadcn/ui components
├── pages/
│   ├── Landing.tsx              # ✅ Marketing page
│   └── App.tsx                  # ✅ Main chat application
├── integrations/
│   └── supabase/
│       ├── client.ts           # ✅ Supabase client setup
│       └── types.ts            # ✅ Database types (empty, ready for schema)
├── hooks/
│   └── useSupabase.ts          # ✅ Placeholder hook ready for implementation
└── types/
    └── index.ts                # ✅ TypeScript interfaces defined
```

## Environment Variables (✅ PARTIALLY COMPLETED)

```env
✅ VITE_SUPABASE_URL=https://npsqlaumhzzlqjtycpim.supabase.co
✅ VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (configured)
❌ VITE_OPENAI_API_KEY=
❌ STRIPE_SECRET_KEY=
```

## Key UI Components Already Built (✅ COMPLETED)

### FileUploadZone (✅ FULLY IMPLEMENTED)
- ✅ Accepts PDF files via drag-and-drop or click
- ✅ Shows upload progress with animated progress bar
- ✅ Lists uploaded documents with metadata and remove buttons
- ✅ Preview area for document content
- ✅ File size formatting and validation
- ✅ Glassmorphism styling and hover effects

### Chat Components (✅ FULLY IMPLEMENTED)
- **ChatInput**: ✅ Auto-expanding textarea, character count, Cmd+Enter to send, file attachment indicator
- **ChatMessage**: ✅ User/assistant message bubbles with avatars and timestamps
- **ChatMessages**: ✅ Scrollable message list with "new messages" indicator and auto-scroll
- **Streaming Support**: ✅ Typing indicators and real-time text rendering states

### App Integration (✅ COMPLETED)
- ✅ Two-column layout with responsive mobile stacking
- ✅ File upload triggers welcome message
- ✅ Simulated AI responses with streaming states
- ✅ Header with back navigation
- ✅ Professional styling with backdrop blur effects

## Database Schema Requirements (❌ NOT IMPLEMENTED)

Ready for implementation - all table structures defined in planning document.

## Implementation Phases

### Phase 1: PDF Upload & Storage ⚡ READY TO START
**Status**: UI completed, backend needs implementation
1. ✅ UI components ready (FileUploadZone fully built)
2. ❌ Set up Supabase Storage bucket for PDFs
3. ❌ Create edge function for file upload with validation
4. ❌ Implement real upload in useSupabase hook
5. ❌ Add file size and type validation (PDF only, max 10MB)

### Phase 2: PDF Text Extraction
**Dependencies**: Phase 1 complete
1. ❌ Create edge function using pdf-parse or similar
2. ❌ Extract text while preserving structure
3. ❌ Implement smart chunking (6000 tokens with 500 overlap)
4. ❌ Store extracted text in database
5. ✅ UI already shows processing status

### Phase 3: OpenAI Chat Integration
**Dependencies**: Phase 2 complete, OPENAI_API_KEY needed
1. ❌ Set up OPENAI_API_KEY secret in Supabase
2. ❌ Create edge function for chat completions
3. ❌ Implement streaming with Server-Sent Events
4. ❌ Add CRE-specific system prompt
5. ✅ ChatInput component ready for real integration
6. ✅ Streaming UI states already implemented

## Current Status Summary

**✅ What's Working:**
- Complete, professional UI with all chat components
- File upload interface with drag-and-drop
- Responsive design for mobile and desktop
- Simulated chat flow with typing indicators
- TypeScript interfaces and project structure
- Supabase connection established

**❌ What Needs Implementation:**
- Real file upload to Supabase Storage
- PDF text extraction
- OpenAI API integration (need to set up secret)
- Database schema creation
- Authentication system
- Payment processing

**🎯 Ready for Phase 1:**
The UI layer is 100% complete. We can immediately start implementing the backend, beginning with Supabase Storage setup for PDF uploads. The FileUploadZone component is already built and just needs the real upload logic connected through the useSupabase hook.

**Next Steps for Implementation:**

1. **Database Schema Setup** - Create all necessary tables (documents, threads, messages, user_profiles, usage_logs) with proper RLS policies

2. **Storage Bucket Creation** - Set up Supabase storage bucket for PDFs with public access policies  

3. **OpenAI API Key Setup** - Use lov-secret-form to collect OPENAI_API_KEY from user

4. **Phase 1: File Upload Implementation**
   - Create edge function for secure PDF upload to storage
   - Update useSupabase hook with real upload functionality  
   - Connect FileUploadZone to actual backend
   - Add file validation (PDF only, max 10MB)

5. **Phase 2: PDF Processing**
   - Create edge function for PDF text extraction using pdf-parse
   - Implement text chunking strategy for AI context
   - Update document status tracking in UI

6. **Phase 3: Chat Integration** 
   - Create streaming chat edge function with OpenAI
   - Implement CRE-specific system prompts
   - Connect ChatInput to real streaming responses
   - Add conversation persistence

The UI is production-ready, so we can focus entirely on backend implementation. All components are built to handle real data and streaming responses.

Implement the plan