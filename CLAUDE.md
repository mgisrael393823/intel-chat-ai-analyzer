# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OM Intel Chat** is an AI-powered commercial real estate (CRE) offering memorandum analyzer. The application allows users to upload PDF documents and chat with AI to extract deal metrics, analyze investment highlights, and get insights about CRE deals. Built with React/TypeScript frontend and Supabase backend.

## Implementation Status

- **Frontend**: 100% complete with all UI components built
- **Backend**: Needs implementation (Supabase storage, OpenAI integration, authentication)
- **Current Phase**: Ready for Phase 1 - PDF upload and storage implementation

## Development Commands

- **Start development**: `npm run dev` (runs on port 8080)
- **Build for production**: `npm run build`
- **Build for development**: `npm run build:dev`
- **Lint code**: `npm run lint`
- **Preview production build**: `npm run preview`

## Tech Stack & Architecture

```
Frontend (✅ Complete):
- React 18 + TypeScript + Vite
- shadcn/ui components + Tailwind CSS
- React Router (Landing `/` and Chat `/app`)
- TanStack Query for server state
- react-dropzone for file uploads
- react-markdown for chat rendering

Backend (❌ To Implement):
- Supabase (Database, Auth, Storage)
- OpenAI API (streaming chat completions)
- Stripe (subscription payments)
- Edge Functions (PDF processing)
```

## Key File Locations

- **Main entry**: `src/main.tsx` → `src/App.tsx` (router setup)
- **Chat application**: `src/pages/App.tsx` (main interface)
- **Landing page**: `src/pages/Landing.tsx`
- **Supabase integration**: `src/integrations/supabase/`
- **Chat components**: `src/components/chat/`
- **Custom hooks**: `src/hooks/useSupabase.ts` (ready for implementation)
- **Type definitions**: `src/types/index.ts`
- **Project requirements**: `docs/OM-INTEL.md`

## Component Architecture

```
src/components/
├── chat/
│   ├── ChatInput.tsx        # Auto-expanding textarea with send/stop
│   ├── ChatMessage.tsx      # User/assistant message bubbles
│   ├── ChatMessages.tsx     # Scrollable list with streaming
│   └── FileUploadZone.tsx   # Drag-drop with progress indicators
├── landing/                 # Complete marketing page components
└── ui/                      # shadcn/ui component library
```

## Implementation Phases (From PRD)

### Phase 1: PDF Upload & Storage (Ready to Start)
1. Set up Supabase Storage bucket for PDFs
2. Create edge function for file upload with validation
3. Implement real upload in `useSupabase.ts` hook
4. Connect `FileUploadZone` to actual backend
5. Add file validation (PDF only, max 10MB)

### Phase 2: PDF Text Extraction
1. Create edge function using pdf-parse
2. Extract text with smart chunking (6000 tokens, 500 overlap)
3. Store extracted text in database
4. Update processing status in UI

### Phase 3: OpenAI Chat Integration
1. Set up OPENAI_API_KEY secret in Supabase
2. Create streaming chat edge function
3. Implement CRE-specific system prompts
4. Connect ChatInput to real streaming responses

## Database Schema Requirements

Tables needed:
- `documents` - PDF uploads and extracted text
- `threads` - Chat conversation threads
- `messages` - Individual chat messages
- `user_profiles` - User data and subscription info
- `usage_logs` - Track uploads for plan enforcement

## Environment Variables

```env
✅ VITE_SUPABASE_URL=https://npsqlaumhzzlqjtycpim.supabase.co
✅ VITE_SUPABASE_ANON_KEY=[configured]
❌ VITE_OPENAI_API_KEY=[needs setup]
❌ STRIPE_SECRET_KEY=[needs setup]
```

## TypeScript Configuration

- Path alias `@/` maps to `src/` directory
- Relaxed strictness settings for rapid development
- Key interfaces: `Message`, `Document`, `Thread`, `DealSnapshot`

## Design System

- Professional finance/real estate theme
- Glassmorphism effects and backdrop blur
- HSL-based color system with CSS custom properties
- Dark mode support via class-based strategy
- Mobile-first responsive design

## Current Simulation vs Real Implementation

**What's Currently Simulated:**
- File upload progress (uses intervals)
- AI chat responses (hardcoded responses)
- Document processing status

**What Needs Real Implementation:**
- Actual PDF upload to Supabase Storage
- PDF text extraction and chunking
- OpenAI streaming API integration
- User authentication and usage tracking

## Next Development Priority

Focus on Phase 1 implementation since UI is complete. Start with Supabase Storage setup and connecting the existing `FileUploadZone` component to real backend functionality through the `useSupabase` hook.