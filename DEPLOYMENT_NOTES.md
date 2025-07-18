# Deployment Configuration Notes

## Supabase Authentication Setup for Production

### Required Manual Steps in Supabase Dashboard:

1. **Go to Supabase Dashboard → Authentication → URL Configuration**
   - Navigate to: https://supabase.com/dashboard/project/npsqlaumhzzlqjtycpim/auth/url-configuration

2. **Add Vercel Domain to Redirect URLs**
   Add these URLs to the "Redirect URLs" list:
   ```
   https://intel-chat-ai-analyzer.vercel.app/**
   https://intel-chat-ai-analyzer.vercel.app/app
   ```

3. **Update Site URL (if needed)**
   Set Site URL to:
   ```
   https://intel-chat-ai-analyzer.vercel.app
   ```

### Current Production URL
- **Deployed App**: https://intel-chat-ai-analyzer.vercel.app/
- **Chat Interface**: https://intel-chat-ai-analyzer.vercel.app/app

### Magic Link Issue Fix
- Updated AuthModal.tsx to use production URL for magic link redirects
- Magic links will now redirect to the correct Vercel URL instead of localhost

### Verification Steps
1. Deploy the updated code
2. Test magic link authentication on production
3. Ensure magic links redirect to https://intel-chat-ai-analyzer.vercel.app/app
4. Confirm authentication flow works end-to-end