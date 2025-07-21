import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

class AuthService {
  private storageKey = `sb-${supabase.supabaseUrl.split('//')[1].split('.')[0]}-auth-token`;

  async getSessionWithTimeout(timeout = 3000): Promise<Session | null> {
    try {
      const sessionPromise = supabase.auth.getSession();
      const { data } = await Promise.race([
        sessionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
      ]) as Awaited<ReturnType<typeof supabase.auth.getSession>>;
      return data.session;
    } catch {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed as Session;
        }
      } catch {
        /* ignore */
      }
      return null;
    }
  }
}

export const authService = new AuthService();
export default authService;
