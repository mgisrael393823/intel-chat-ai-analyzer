import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      console.log('AuthCallback: Processing magic link...');
      console.log('Current URL:', window.location.href);
      
      try {
        // Get the hash from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');

        if (error) {
          console.error('Auth callback error:', error, errorDescription);
          navigate('/?error=' + encodeURIComponent(error));
          return;
        }

        if (access_token && refresh_token) {
          console.log('AuthCallback: Setting session from tokens...');
          
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token
          });

          if (sessionError) {
            console.error('Session error:', sessionError);
            navigate('/?error=session_failed');
            return;
          }

          if (data.user) {
            console.log('AuthCallback: Successfully authenticated user:', data.user.email);
            // Redirect to app
            navigate('/app');
          } else {
            console.error('No user data after setting session');
            navigate('/?error=no_user');
          }
        } else {
          console.error('No auth tokens found in URL');
          navigate('/?error=no_tokens');
        }
      } catch (err) {
        console.error('Error processing auth callback:', err);
        navigate('/?error=callback_failed');
      }
    };

    // Add a small delay to ensure the URL is fully loaded
    const timeout = setTimeout(handleAuthCallback, 100);
    
    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <h2 className="text-xl font-semibold">Completing Sign In</h2>
        <p className="text-muted-foreground">Please wait while we authenticate you...</p>
      </div>
    </div>
  );
};