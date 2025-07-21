# 🤖 OM Intel Chat AI Analyzer - Agent Documentation

This document provides comprehensive information for AI agents and developers working on the OM Intel Chat AI Analyzer project. It includes all necessary setup instructions, known issues, and development guidelines.

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Environment Setup](#environment-setup)
4. [Known Critical Issues](#known-critical-issues)
5. [Codebase Structure](#codebase-structure)
6. [Development Workflow](#development-workflow)
7. [Testing Procedures](#testing-procedures)
8. [Deployment Guide](#deployment-guide)
9. [Troubleshooting](#troubleshooting)
10. [Quick Reference](#quick-reference)

---

## 🎯 Project Overview

**OM Intel Chat AI Analyzer** is a commercial real estate document analysis platform that uses AI to extract insights from offering memoranda (PDFs).

### Core Features
- 📄 PDF upload and text extraction
- 💬 AI-powered chat interface using OpenAI GPT-4
- 📊 Automated financial metrics extraction
- 🔄 Real-time document processing status
- 🔐 Secure authentication with Supabase

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: OpenAI GPT-4o-mini
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth (email/password)
- **Deployment**: Supabase + Vercel/Netlify

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React SPA     │────▶│  Supabase Edge   │────▶│   PostgreSQL    │
│  (Vite + TS)    │     │    Functions     │     │   + Storage     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Supabase Auth  │     │   OpenAI API     │     │  Realtime Subs  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Key Components
1. **Frontend (React)**: Single-page application with protected routes
2. **Edge Functions**: Serverless functions for chat, PDF processing
3. **Database**: PostgreSQL with Row Level Security (RLS)
4. **Storage**: Object storage for PDF files
5. **Realtime**: WebSocket subscriptions for live updates

---

## 🔧 Environment Setup

### Prerequisites
- Node.js 18+ and npm
- Supabase CLI (`npm install -g supabase`)
- Git
- OpenAI API key

### Required Environment Variables

#### Frontend (Hardcoded in `/src/integrations/supabase/client.ts`)
```typescript
SUPABASE_URL = "https://npsqlaumhzzlqjtycpim.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wc3FsYXVtaHp6bHFqdHljcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDAzMzAsImV4cCI6MjA2ODI3NjMzMH0.i_dRSQj_l5bpzHjKMeq58QjWwoa8Y2QikeZrav8-rxo"
```

#### Edge Functions Secrets (Set via Supabase CLI)
```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Required
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...           # Optional (for admin operations)
```

### Complete Setup Script
```bash
#!/bin/bash
# Save as setup.sh and run with: bash setup.sh

set -e

echo "🎯 OM Intel Chat Complete Setup"
echo "==============================="

# 1. Install dependencies
npm install

# 2. Install Supabase CLI
if ! command -v supabase &> /dev/null; then
    npm install -g supabase
fi

# 3. Login to Supabase
supabase login

# 4. Link project
supabase link --project-ref npsqlaumhzzlqjtycpim

# 5. Set OpenAI API key
read -p "Enter your OpenAI API key (sk-...): " OPENAI_KEY
supabase secrets set OPENAI_API_KEY=$OPENAI_KEY

# 6. Deploy Edge Functions
for func in chat-stream extract-pdf-text extract-pdf-stream generate-snapshot upload-pdf; do
    echo "Deploying $func..."
    supabase functions deploy $func
done

# 7. Run migrations
supabase db push

# 8. Enable realtime
supabase sql -f - <<EOF
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.threads;
EOF

# 9. Build frontend
npm run build

echo "✅ Setup complete!"
```

---

## 🚨 Known Critical Issues

### 1. **Authentication Hanging (CRITICAL)**
**Status**: Partially mitigated with localStorage workaround  
**Location**: `/src/hooks/useSupabase.ts`

**Problem**: `supabase.auth.getSession()` and `getUser()` hang indefinitely

**Current Workaround**:
```typescript
// Reading directly from localStorage (insecure but functional)
const storageKey = `sb-${supabase.supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
const storedSession = localStorage.getItem(storageKey);
```

**Proper Fix Needed**: Implement timeout wrapper with proper error handling

### 2. **Chat SSE Not Streaming (CRITICAL)**
**Status**: Edge Function returns 200 but no data received  
**Location**: `/supabase/functions/chat-stream/index.ts`

**Symptoms**:
- HTTP 200 response
- Proper SSE headers set
- No data chunks received by client

**Debug Command**:
```bash
curl -N -H "Accept: text/event-stream" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}' \
  https://npsqlaumhzzlqjtycpim.supabase.co/functions/v1/chat-stream
```

### 3. **PDF Status Not Updating (HIGH)**
**Status**: Documents stuck in "processing"  
**Location**: `/supabase/functions/extract-pdf-text/index.ts`

**Problem**: Realtime subscriptions not triggering UI updates

**Check Realtime**:
```sql
-- Run in Supabase SQL editor
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

### 4. **Infinite Re-renders (MEDIUM)**
**Status**: Partially fixed  
**Location**: `/src/components/auth/ProtectedRoute.tsx`

**Problem**: Multiple auth listeners causing render loops

---

## 📁 Codebase Structure

```
intel-chat-ai-analyzer/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── AuthModal.tsx          # Email/password auth UI
│   │   │   └── ProtectedRoute.tsx     # Auth gate (has re-render issues)
│   │   └── chat/
│   │       ├── ChatInput.tsx          # Message input
│   │       ├── ChatMessages.tsx       # Message display
│   │       └── FileUploadZone.tsx     # PDF upload UI
│   ├── hooks/
│   │   ├── useSupabase.ts            # Main data operations (has auth hanging)
│   │   └── useAuthSession.ts         # Auth state management
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts             # Supabase client config
│   │       └── types.ts              # Generated TypeScript types
│   └── pages/
│       ├── App.tsx                   # Main app page
│       └── Landing.tsx               # Landing page
├── supabase/
│   ├── functions/
│   │   ├── chat-stream/              # SSE chat endpoint (not working)
│   │   ├── extract-pdf-text/         # PDF processing
│   │   └── upload-pdf/               # File upload handler
│   └── migrations/                   # Database schema
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

### Key Files to Review
1. **`/src/hooks/useSupabase.ts`** - Contains auth workarounds and main data operations
2. **`/src/components/auth/ProtectedRoute.tsx`** - Has re-render issues
3. **`/supabase/functions/chat-stream/index.ts`** - SSE implementation
4. **`/supabase/functions/extract-pdf-text/index.ts`** - PDF processing logic

---

## 💻 Development Workflow

### Local Development
```bash
# Start development server
npm run dev

# Run linting
npm run lint

# Build for production
npm run build
```

### Working with Edge Functions
```bash
# Deploy a single function
supabase functions deploy function-name

# View function logs
supabase functions logs function-name --tail

# Test function locally
supabase functions serve function-name --debug
```

### Database Changes
```bash
# Create new migration
supabase migration new migration-name

# Apply migrations
supabase db push

# Reset database
supabase db reset
```

---

## 🧪 Testing Procedures

### 1. Test Authentication
```javascript
// Run in browser console
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'testpassword'
});
console.log('Auth result:', { data, error });
```

### 2. Test Chat Streaming
```bash
# Get auth token from browser
TOKEN=$(localStorage.getItem('sb-npsqlaumhzzlqjtycpim-auth-token') | jq -r .access_token)

# Test SSE endpoint
curl -N -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is commercial real estate?"}' \
  https://npsqlaumhzzlqjtycpim.supabase.co/functions/v1/chat-stream
```

### 3. Test PDF Upload
```javascript
// Test file upload
const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
const result = await uploadFile(file);
console.log('Upload result:', result);
```

### 4. Test Realtime
```javascript
// Subscribe to document changes
const channel = supabase
  .channel('test-documents')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'documents'
  }, payload => {
    console.log('Change received:', payload);
  })
  .subscribe();
```

---

## 🚀 Deployment Guide

### Frontend Deployment (Vercel/Netlify)
```bash
# Build the app
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy to Netlify
netlify deploy --prod --dir=dist
```

### Edge Functions Deployment
```bash
# Deploy all functions
supabase functions deploy --no-verify-jwt

# Deploy with specific import map
supabase functions deploy function-name --import-map import_map.json
```

### Database Deployment
```bash
# Push migrations to production
supabase db push --linked

# Seed production data (if needed)
supabase db seed
```

---

## 🔍 Troubleshooting

### Common Issues

#### "getSession() hanging"
```typescript
// Use this timeout wrapper
async function getSessionWithTimeout(timeout = 3000) {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ]);
}
```

#### "No SSE data received"
1. Check OpenAI API key is set: `supabase secrets list`
2. Verify Edge Function logs: `supabase functions logs chat-stream`
3. Test with curl using `-N` flag for no buffering

#### "PDF stuck in processing"
1. Check extraction function logs
2. Verify realtime is enabled: `SELECT * FROM pg_publication_tables`
3. Test manual status update in SQL

#### "Infinite re-renders"
1. Check for multiple auth listeners
2. Use React DevTools Profiler
3. Add console.log to track render cycles

### Debug Commands
```bash
# Check function deployment
supabase functions list

# View all secrets
supabase secrets list

# Test database connection
supabase db dump --data-only

# Monitor realtime connections
supabase inspect db connections
```

---

## 📚 Quick Reference

### Supabase URLs
- **Project URL**: https://npsqlaumhzzlqjtycpim.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/npsqlaumhzzlqjtycpim
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wc3FsYXVtaHp6bHFqdHljcGltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MDAzMzAsImV4cCI6MjA2ODI3NjMzMH0.i_dRSQj_l5bpzHjKMeq58QjWwoa8Y2QikeZrav8-rxo`

### Git Repository
- **URL**: https://github.com/mgisrael393823/intel-chat-ai-analyzer
- **Main Branch**: `main`
- **Current Issues**: See [Known Critical Issues](#known-critical-issues)

### Key Dependencies
```json
{
  "@supabase/supabase-js": "^2.51.0",
  "react": "^18.3.1",
  "typescript": "^5.5.3",
  "vite": "^5.4.1"
}
```

### Contact for Help
- Review the error logs in Supabase Dashboard
- Check browser console for client-side errors
- Use `supabase functions logs` for Edge Function debugging

---

## 🎯 Priority Action Items

1. **Fix Auth Hanging**: Implement proper timeout handling for `getSession()`
2. **Debug SSE Streaming**: Investigate why chat responses aren't streaming
3. **Fix Realtime Updates**: Ensure document status changes propagate to UI
4. **Optimize Re-renders**: Consolidate auth state management

---

*Last Updated: January 2025*
*Project Status: Production with critical bugs*