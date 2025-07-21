import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

class AuthService {
  private static instance: AuthService;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async getSession(timeout = 3000): Promise<Session | null> {
    try {
      const sessionPromise = supabase.auth.getSession();
      const { data: { session }, error } = await Promise.race([
        sessionPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeout)
        )
      ]) as Awaited<typeof sessionPromise>;

      if (error || !session) {
        return null;
      }

      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        return null;
      }

      return session;
    } catch {
      return this.getSessionFromStorage();
    }
  }

  private getSessionFromStorage(): Session | null {
    try {
      const key = `sb-${supabase.supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      if (parsed.expires_at && parsed.expires_at * 1000 < Date.now()) {
        return null;
      }
      return parsed;
    } catch (err) {
      console.error('Failed to read session from storage', err);
      return null;
    }
  }
}

export const authService = AuthService.getInstance();
export default AuthService;
