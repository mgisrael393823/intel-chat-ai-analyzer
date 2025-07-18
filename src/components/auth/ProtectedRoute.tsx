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
    // Get initial session
    const getSession = async () => {
      console.log('ProtectedRoute: Getting initial session...');
      console.log('Current URL:', window.location.href);
      console.log('Hash params:', window.location.hash);
      console.log('Search params:', window.location.search);
      
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('ProtectedRoute: Session result:', { session, error });
      
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session?.user) {
        setShowAuthModal(true);
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('ProtectedRoute: Auth state change:', { event, session });
        console.log('User from session:', session?.user);
        
        setUser(session?.user ?? null);
        setIsLoading(false);

        if (event === 'SIGNED_IN') {
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
      }
    );

    return () => subscription.unsubscribe();
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
          <h2 className="text-xl font-semibold mb-4">Loading...</h2>
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
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