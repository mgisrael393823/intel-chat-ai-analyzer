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
    
    // Simple session check with quick timeout
    const checkSession = async () => {
      console.log('ProtectedRoute: Quick session check...');
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('Session error:', error);
          setUser(null);
        } else {
          setUser(session?.user ?? null);
          if (!session?.user) {
            setShowAuthModal(true);
          }
        }
      } catch (err) {
        console.error('Session check failed:', err);
        if (mounted) {
          setUser(null);
          setShowAuthModal(true);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('ProtectedRoute: Auth state change:', { event, userEmail: session?.user?.email });
        
        if (!mounted) return;
        
        setUser(session?.user ?? null);
        setIsLoading(false);

        if (event === 'SIGNED_IN') {
          console.log('ProtectedRoute: User signed in');
          setShowAuthModal(false);
          if (session?.user) {
            await createUserProfileIfNeeded(session.user);
          }
        }

        if (event === 'SIGNED_OUT') {
          console.log('ProtectedRoute: User signed out');
          setShowAuthModal(true);
        }
      }
    );
    
    // Quick session check with 2 second timeout
    const timeoutId = setTimeout(() => {
      if (mounted && isLoading) {
        console.log('ProtectedRoute: Quick timeout - showing auth');
        setIsLoading(false);
        setShowAuthModal(true);
      }
    }, 2000);
    
    checkSession();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
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
    console.log('ProtectedRoute: Checking auth...');
    return fallback || (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
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