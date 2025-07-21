import React, { memo } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { AuthModal } from './AuthModal';
import { Spinner } from '@/components/ui/spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = memo(({ children }) => {
  const { user, isLoading } = useAuthSession();

  if (isLoading) return <Spinner />;
  if (!user) return <AuthModal isOpen onClose={() => {}} />;
  return <>{children}</>;
});
