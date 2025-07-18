import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      // Use production URL for deployed app, localhost for development
      const redirectUrl = window.location.hostname === 'localhost' 
        ? `${window.location.origin}/app`
        : 'https://intel-chat-ai-analyzer.vercel.app/app';

      console.log('Magic link redirect URL:', redirectUrl);
      console.log('Current hostname:', window.location.hostname);
      console.log('Current origin:', window.location.origin);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        setMessage(error.message);
        setIsSuccess(false);
      } else {
        setMessage('Check your email for the magic link!');
        setIsSuccess(true);
        setTimeout(() => {
          onClose();
          onSuccess?.();
        }, 2000);
      }
    } catch (err) {
      setMessage('An unexpected error occurred');
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setMessage('');
    setIsSuccess(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Sign in to OM Intel Chat
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleMagicLink} className="space-y-4">
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
            disabled={isLoading || !email}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending Magic Link...
              </>
            ) : (
              'Send Magic Link'
            )}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            We'll send you a secure link to sign in without a password.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};