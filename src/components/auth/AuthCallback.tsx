import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let processed = false;
    
    const handleAuthCallback = async () => {
      if (processed) return;
      processed = true;
      
      
      try {
        // Get the hash from the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');


        if (error) {
          navigate('/?error=' + encodeURIComponent(error));
          return;
        }

        if (access_token && refresh_token) {
          
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token
          });


          if (sessionError) {
            navigate('/?error=session_failed');
            return;
          }

          if (data.user) {
            // Small delay before redirect to ensure session is set
            setTimeout(() => {
              navigate('/app');
            }, 500);
          } else {
            navigate('/?error=no_user');
          }
        } else {
          navigate('/?error=no_tokens');
        }
      } catch (err) {
        navigate('/?error=callback_failed');
      }
    };

    // Timeout to prevent infinite loading
    const fallbackTimeout = setTimeout(() => {
      if (!processed) {
        navigate('/?error=timeout');
      }
    }, 10000); // 10 second timeout

    // Add a small delay to ensure the URL is fully loaded
    const processTimeout = setTimeout(handleAuthCallback, 100);
    
    return () => {
      clearTimeout(processTimeout);
      clearTimeout(fallbackTimeout);
    };
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