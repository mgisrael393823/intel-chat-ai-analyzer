import React from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { AuthModal } from './AuthModal'

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, fallback }) => {
  const { user, isLoading } = useAuthSession()
  const [showAuthModal, setShowAuthModal] = React.useState(false)

  React.useEffect(() => {
    if (!isLoading && !user) setShowAuthModal(true)
  }, [isLoading, user])

  if (isLoading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) {
    return <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} />
  }

  return <>{children}</>
}