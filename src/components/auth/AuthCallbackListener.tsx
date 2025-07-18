import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export const AuthCallbackListener = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing authentication...');

  useEffect(() => {
    console.log('🎯 AuthCallbackListener: Starting with auth state listener approach');
    console.log('📍 URL:', window.location.href);
    console.log('🔗 Hash:', window.location.hash);

    let processed = false;

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔔 Auth state change event:', { event, session: !!session, userEmail: session?.user?.email });
        
        if (processed) return;
        
        if (event === 'SIGNED_IN' && session) {
          processed = true;
          console.log('✅ User signed in via magic link!', session.user.email);
          setStatus('Success! Redirecting to app...');
          
          // Small delay to show success message
          setTimeout(() => {
            navigate('/app');
          }, 1000);
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('❌ User signed out');
          setStatus('Authentication failed');
          setTimeout(() => navigate('/?error=signed_out'), 2000);
        }
        
        if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token refreshed');
        }
      }
    );

    // Fallback timeout
    const timeout = setTimeout(() => {
      if (!processed) {
        console.error('⏰ AuthCallbackListener: Timeout - no auth event received');
        setStatus('Authentication timeout');
        setTimeout(() => navigate('/?error=auth_timeout'), 1000);
      }
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <h2 className="text-xl font-semibold">Completing Sign In</h2>
        <p className="text-muted-foreground">{status}</p>
        <p className="text-xs text-muted-foreground mt-4">
          Using auth state listener approach...
        </p>
      </div>
    </div>
  );
};