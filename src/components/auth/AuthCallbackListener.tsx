import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const AuthCallbackListener = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    let mounted = true;
    
    const handleAuth = async () => {
      console.log('🎯 AuthCallbackListener: Starting magic link processing');
      console.log('📍 Current URL:', window.location.href);
      console.log('🔗 Hash before exchange:', window.location.hash);
      
      try {
        // Step 1: Exchange URL tokens for session
        console.log('🔄 Attempting to get session from URL...');
        setStatus('Exchanging authentication tokens...');
        
        const { data: { session: urlSession }, error: urlError } = 
          await supabase.auth.getSessionFromUrl({ storeSession: true });
          
        if (urlError) {
          console.error('❌ getSessionFromUrl error:', urlError);
          setStatus('Token exchange failed');
          setTimeout(() => navigate('/?error=token_exchange_failed'), 2000);
          return;
        }
        
        console.log('✅ Session from URL:', {
          hasSession: !!urlSession,
          hasUser: !!urlSession?.user,
          userEmail: urlSession?.user?.email,
          accessToken: urlSession?.access_token?.substring(0, 20) + '...',
        });
        
        if (!mounted) return;
        
        if (urlSession) {
          console.log('🎉 Successfully got session from URL, redirecting to app...');
          setStatus('Success! Redirecting to app...');
          setTimeout(() => navigate('/app'), 1000);
          return;
        }
        
        // Step 2: If no session from URL, listen for auth state changes
        console.log('⏳ No immediate session, setting up auth state listener...');
        setStatus('Waiting for authentication confirmation...');
        
      } catch (err) {
        console.error('💥 Unexpected URL exchange error:', err);
        setStatus('Authentication error occurred');
        setTimeout(() => navigate('/?error=auth_exchange_error'), 2000);
        return;
      }
      
      // Step 3: Subscribe to auth state changes as fallback
      console.log('👂 Setting up auth state change listener...');
      let processed = false;
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('🔔 Auth state change event:', {
            event,
            hasSession: !!session,
            userEmail: session?.user?.email,
            processed
          });
          
          if (processed || !mounted) return;
          
          if (event === 'SIGNED_IN' && session) {
            processed = true;
            console.log('✅ SIGNED_IN event received:', {
              userEmail: session.user?.email,
              accessToken: session.access_token?.substring(0, 20) + '...'
            });
            setStatus('Signed in successfully! Redirecting...');
            setTimeout(() => navigate('/app'), 500);
            return;
          }
          
          if (event === 'SIGNED_OUT') {
            console.log('❌ SIGNED_OUT event received');
            setStatus('Sign out detected');
            setTimeout(() => navigate('/?error=signed_out'), 1000);
            return;
          }
          
          console.log('ℹ️ Other auth event:', event);
        }
      );
      
      // Extended timeout fallback (30 seconds instead of 5)
      const timeout = setTimeout(() => {
        if (!processed && mounted) {
          console.error('⏰ AuthCallbackListener: Extended timeout (30s) - no successful auth');
          console.error('⏰ Final URL state:', window.location.href);
          console.error('⏰ Final hash:', window.location.hash);
          setStatus('Authentication timeout - please try again');
          setTimeout(() => navigate('/?error=auth_timeout_extended'), 2000);
        }
      }, 30000); // 30 second timeout
      
      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    };
    
    // Start the auth handling process
    handleAuth();
    
    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <h2 className="text-xl font-semibold">Completing Sign In</h2>
        <p className="text-muted-foreground">{status}</p>
        <p className="text-xs text-muted-foreground mt-4">
          Processing magic link authentication...
        </p>
        <p className="text-xs text-muted-foreground">
          Check browser console for detailed logs
        </p>
      </div>
    </div>
  );
};