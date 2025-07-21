import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Custom hook to manage Supabase authentication session
 * Prevents hanging issues and handles token refresh properly
 */
export const useAuthSession = () => {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    let refreshTimer: NodeJS.Timeout;

    // Initial session check with timeout
    const checkSession = async () => {
      try {
        // Set a timeout for the session check
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Session check timeout')), 5000);
        });

        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise,
        ]) as Awaited<typeof sessionPromise>;

        if (!mounted) return;

        if (error) {
          throw error;
        }

        setAuthState({
          session,
          user: session?.user || null,
          isLoading: false,
          error: null,
        });

        // Set up token refresh timer if we have a session
        if (session && session.expires_at) {
          const expiresAt = new Date(session.expires_at * 1000);
          const refreshAt = new Date(expiresAt.getTime() - 60000); // Refresh 1 minute before expiry
          const timeout = refreshAt.getTime() - Date.now();
          
          if (timeout > 0) {
            refreshTimer = setTimeout(async () => {
              if (mounted) {
                const { data: { session: newSession } } = await supabase.auth.refreshSession();
                if (mounted && newSession) {
                  setAuthState(prev => ({
                    ...prev,
                    session: newSession,
                    user: newSession.user,
                  }));
                }
              }
            }, timeout);
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
        if (mounted) {
          setAuthState({
            session: null,
            user: null,
            isLoading: false,
            error: error as Error,
          });
        }
      }
    };

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth state change:', event, session?.user?.email);

        // Clear any existing refresh timer
        if (refreshTimer) {
          clearTimeout(refreshTimer);
        }

        setAuthState({
          session,
          user: session?.user || null,
          isLoading: false,
          error: null,
        });

        // Handle token refresh for new sessions
        if (session && session.expires_at && event !== 'TOKEN_REFRESHED') {
          const expiresAt = new Date(session.expires_at * 1000);
          const refreshAt = new Date(expiresAt.getTime() - 60000);
          const timeout = refreshAt.getTime() - Date.now();
          
          if (timeout > 0) {
            refreshTimer = setTimeout(async () => {
              if (mounted) {
                await supabase.auth.refreshSession();
              }
            }, timeout);
          }
        }
      }
    );

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setAuthState({
        session: null,
        user: null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthState(prev => ({
        ...prev,
        error: error as Error,
      }));
    }
  };

  const getValidToken = async (): Promise<string | null> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        return null;
      }

      // Check if token is about to expire
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      // If token expires in less than 2 minutes, refresh it
      if (timeUntilExpiry < 120000) {
        const { data: { session: newSession } } = await supabase.auth.refreshSession();
        return newSession?.access_token || null;
      }

      return session.access_token;
    } catch (error) {
      console.error('Error getting valid token:', error);
      return null;
    }
  };

  return {
    ...authState,
    signOut,
    getValidToken,
  };
};