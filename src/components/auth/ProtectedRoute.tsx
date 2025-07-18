import React, { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthModal } from './AuthModal';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback 
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  console.log('ProtectedRoute render:', { user, isLoading, showAuthModal });

  useEffect(() => {
    let mounted = true;
    
    // Check if we have auth params in the URL (from magic link)
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      
      if (access_token && refresh_token) {
        console.log('ProtectedRoute: Found auth tokens in URL, setting session...');
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token
          });
          
          if (error) {
            console.error('Error setting session from tokens:', error);
          } else {
            console.log('Successfully set session from magic link');
            // Clean up URL
            window.history.replaceState(null, '', window.location.pathname);
          }
        } catch (err) {
          console.error('Failed to set session from tokens:', err);
        }
      }
    };
    
    // Get initial session
    const getSession = async () => {
      console.log('ProtectedRoute: Getting initial session...');
      console.log('Current URL:', window.location.href);
      console.log('Hash params:', window.location.hash);
      console.log('Search params:', window.location.search);
      
      // First check for auth callback
      await handleAuthCallback();
      
      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (mounted && isLoading) {
          console.error('Session fetch timeout - forcing completion');
          setIsLoading(false);
          setUser(null);
          setShowAuthModal(true);
        }
      }, 5000); // 5 second timeout
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('ProtectedRoute: Session result:', { session, error });
        
        if (!mounted) return;
        
        clearTimeout(timeoutId);
        
        if (error) {
          console.error('Session fetch error:', error);
          setUser(null);
          setShowAuthModal(true);
        } else {
          setUser(session?.user ?? null);
          if (!session?.user) {
            setShowAuthModal(true);
          }
        }
      } catch (err) {
        console.error('Unexpected session error:', err);
        // Log to remote monitoring in production
        if (window.location.hostname !== 'localhost') {
          console.error('[PROD ERROR] ProtectedRoute session fetch failed:', {
            error: err,
            timestamp: new Date().toISOString(),
            url: window.location.href
          });
        }
        if (mounted) {
          setUser(null);
          setShowAuthModal(true);
        }
      } finally {
        if (mounted) {
          clearTimeout(timeoutId);
          setIsLoading(false);
        }
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('ProtectedRoute: Auth state change:', { event, session });
        console.log('User from session:', session?.user);
        
        if (!mounted) return;
        
        setUser(session?.user ?? null);
        setIsLoading(false);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('ProtectedRoute: User signed in successfully');
          setShowAuthModal(false);
          // Auto-create user profile if it doesn't exist
          if (session?.user) {
            await createUserProfileIfNeeded(session.user);
          }
        }

        if (event === 'SIGNED_OUT') {
          console.log('ProtectedRoute: User signed out');
          setShowAuthModal(true);
        }
        
        // Handle initial session from magic link
        if (event === 'INITIAL_SESSION' && session) {
          console.log('ProtectedRoute: Initial session detected');
          setShowAuthModal(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const createUserProfileIfNeeded = async (user: User) => {
    try {
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
        const { error } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email,
            subscription_plan: 'free',
            subscription_status: 'active',
          });

        if (error) {
          console.error('Error creating user profile:', error);
        }
      }
    } catch (error) {
      console.error('Error checking/creating user profile:', error);
    }
  };

  if (isLoading) {
    console.log('ProtectedRoute: Still loading...');
    return fallback || (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="max-w-md w-full space-y-4 p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Loading OM Intel Chat...</h2>
          <p className="text-sm text-muted-foreground mb-4">Checking authentication status</p>
          <div className="flex justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
          <p className="text-xs text-muted-foreground mt-4">
            Taking longer than expected? Check your internet connection.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('ProtectedRoute: No user, showing auth screen');
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
          <div className="max-w-md w-full text-center space-y-4 p-6">
            <h1 className="text-2xl font-semibold">Welcome to OM Intel Chat</h1>
            <p className="text-muted-foreground">
              Sign in to upload and analyze commercial real estate documents with AI.
            </p>
            {/* Add a manual sign in button as backup */}
            {!showAuthModal && (
              <Button 
                onClick={() => setShowAuthModal(true)}
                className="mt-4"
              >
                Sign In with Email
              </Button>
            )}
          </div>
        </div>
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  return <>{children}</>;
};