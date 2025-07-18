import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const AuthCallbackListener = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    const handleAuth = async () => {
      // === Step 1: exchange the magic-link tokens in the URL ===
      console.log('Starting auth callback');
      console.log('URL hash before exchange', window.location.hash);
      
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
        
        console.log('Session from URL:', {
          email: urlSession?.user?.email,
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
          console.log('🔔 Auth state change event:', event);
          
          if (processed || !mounted) return;
          
          if (event === 'SIGNED_IN' && session) {
            processed = true;
            console.log('Signed in via fallback listener');
            setStatus('Signed in successfully! Redirecting...');
            setTimeout(() => navigate('/app'), 500);
            return;
          }

          if (event === 'SIGNED_OUT') {
            console.log('Signed out detected');
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
          console.log('Authentication timeout reached');
          setStatus('Authentication timeout - please try again');
          setTimeout(() => navigate('/?error=auth_timeout_extended'), 2000);
        }
      }, 30000);
      
      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    };
    
    // Start the auth handling process
    handleAuth().then(fn => {
      cleanup = fn;
    });

    return () => {
      mounted = false;
      cleanup?.();
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