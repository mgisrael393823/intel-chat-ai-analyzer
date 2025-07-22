import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const AuthCallbackSimple = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    let mounted = true;
    
    const handleAuth = async () => {
      if (!mounted) return;
      
      
      // Check if we have auth tokens in URL
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      const error = hashParams.get('error');
      const error_description = hashParams.get('error_description');
      
      
      try {
        if (error) {
          setStatus(`Auth error: ${error}`);
          setTimeout(() => navigate(`/?error=${encodeURIComponent(error)}`), 3000);
          return;
        }
        
        setStatus('Checking authentication...');
        
        // Wait a bit for Supabase to process the tokens
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check the session - Supabase should handle the tokens automatically
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        
        if (!mounted) return;
        
        if (sessionError) {
          setStatus('Authentication failed');
          setTimeout(() => navigate('/?error=session_check_failed'), 2000);
          return;
        }
        
        if (session?.user) {
          setStatus('Success! Redirecting...');
          setTimeout(() => navigate('/app'), 1000);
        } else {
          setStatus('No session found - redirecting...');
          setTimeout(() => navigate('/?error=no_session'), 2000);
        }
      } catch (err) {
        if (mounted) {
          setStatus('Error occurred');
          setTimeout(() => navigate('/?error=callback_error'), 2000);
        }
      }
    };

    // Timeout fallback
    const timeout = setTimeout(() => {
      if (mounted) {
        setStatus('Taking too long...');
        setTimeout(() => navigate('/?error=timeout'), 1000);
      }
    }, 8000);

    // Small delay to let Supabase process the URL
    const delayTimeout = setTimeout(handleAuth, 500);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      clearTimeout(delayTimeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <h2 className="text-xl font-semibold">Completing Sign In</h2>
        <p className="text-muted-foreground">{status}</p>
        <p className="text-xs text-muted-foreground mt-4">
          If this takes too long, you'll be redirected automatically.
        </p>
      </div>
    </div>
  );
};