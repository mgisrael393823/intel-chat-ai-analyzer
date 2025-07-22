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
      
      try {
        // Step 1: Exchange URL tokens for session
        setStatus('Exchanging authentication tokens...');
        
        const { data: { session: urlSession }, error: urlError } = 
          await supabase.auth.getSession();
          
        if (urlError) {
          setStatus('Token exchange failed');
          setTimeout(() => navigate('/?error=token_exchange_failed'), 2000);
          return;
        }
        
        
        if (!mounted) return;
        
        if (urlSession) {
          setStatus('Success! Redirecting to app...');
          setTimeout(() => navigate('/app'), 1000);
          return;
        }
        
        // Step 2: If no session from URL, listen for auth state changes
        setStatus('Waiting for authentication confirmation...');
        
      } catch (err) {
        setStatus('Authentication error occurred');
        setTimeout(() => navigate('/?error=auth_exchange_error'), 2000);
        return;
      }
      
      // Step 3: Subscribe to auth state changes as fallback
      let processed = false;
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          
          if (processed || !mounted) return;
          
          if (event === 'SIGNED_IN' && session) {
            processed = true;
            setStatus('Signed in successfully! Redirecting...');
            setTimeout(() => navigate('/app'), 500);
            return;
          }

          if (event === 'SIGNED_OUT') {
            setStatus('Sign out detected');
            setTimeout(() => navigate('/?error=signed_out'), 1000);
            return;
          }
          
        }
      );
      
      // Extended timeout fallback (30 seconds instead of 5)
      const timeout = setTimeout(() => {
        if (!processed && mounted) {
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
      </div>
    </div>
  );
};