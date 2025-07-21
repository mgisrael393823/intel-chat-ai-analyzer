import React from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { AuthModal } from './AuthModal';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback 
}) => {
  const { user, isLoading, error } = useAuthSession();
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  
  // Only show auth modal if we're not loading and there's no user
  React.useEffect(() => {
    if (!isLoading && !user) {
      setShowAuthModal(true);
    } else if (user) {
      setShowAuthModal(false);
    }
  }, [isLoading, user]);

  if (isLoading) {
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
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
          <div className="max-w-md w-full text-center space-y-4 p-6">
            <h1 className="text-2xl font-semibold">Welcome to OM Intel Chat</h1>
            <p className="text-muted-foreground">
              Sign in to upload and analyze commercial real estate documents with AI.
            </p>
            {error && (
              <p className="text-sm text-red-500">
                {error.message}
              </p>
            )}
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

  // User is authenticated - just render children
  return <>{children}</>;
};