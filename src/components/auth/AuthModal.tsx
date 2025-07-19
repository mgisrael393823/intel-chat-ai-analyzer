import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    // Clear any stale sessions first
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.log('Sign out error (non-critical):', err);
    }

    // Add timeout
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      setMessage('Authentication is taking too long. Please try again.');
      setIsSuccess(false);
    }, 10000); // 10 second timeout

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          setIsSuccess(false);
        } else if (data.user && !data.user.email_confirmed_at) {
          setMessage('Please check your email and click the confirmation link, then try signing in.');
          setIsSuccess(true);
          setIsSignUp(false); // Switch to sign in mode
        } else {
          setMessage('Account created successfully!');
          setIsSuccess(true);
          setTimeout(() => {
            onClose();
            onSuccess?.();
          }, 1000);
        }
      } else {
        console.log('Attempting sign in for:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        console.log('Sign in response:', { data, error });

        if (error) {
          // Provide more specific error messages
          if (error.message.includes('Invalid login credentials')) {
            setMessage('Invalid email or password. Please check your credentials and try again.');
          } else if (error.message.includes('Email not confirmed')) {
            setMessage('Please confirm your email address before signing in. Check your inbox for the confirmation link.');
          } else {
            setMessage(error.message);
          }
          setIsSuccess(false);
        } else if (data.user) {
          setMessage('Signed in successfully!');
          setIsSuccess(true);
          setTimeout(() => {
            onClose();
            onSuccess?.();
          }, 1000);
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setMessage('An unexpected error occurred. Please check the console for details.');
      setIsSuccess(false);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setMessage('');
    setIsSuccess(false);
    setIsSignUp(false);
    setShowPassword(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {isSignUp ? 'Create Account' : 'Sign In'} - OM Intel Chat
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {isSignUp && (
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long
              </p>
            )}
          </div>

          {message && (
            <Alert>
              <AlertDescription className={isSuccess ? 'text-green-600' : 'text-red-600'}>
                {message}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !email || !password}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isSignUp ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="link"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage('');
                setPassword('');
              }}
              disabled={isLoading}
              className="text-sm"
            >
              {isSignUp 
                ? 'Already have an account? Sign in' 
                : "Don't have an account? Create one"
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};