import { create } from 'zustand';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import API from '../services/api';

interface AuthState {
  session: Session | null;
  user: any | null;
  profile: any | null;
  role: 'pt' | 'client' | null;
  token: string | null;
  clientProfileId: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  profileError: string | null;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  fetchClientProfileId: () => Promise<void>;
}

const RESET_STATE = {
  session: null,
  user: null,
  profile: null,
  role: null as null,
  token: null,
  clientProfileId: null,
  isLoading: false,
  profileError: null,
};

/**
 * Wraps any promise with a timeout. Resolves (not rejects) after ms —
 * so it never blocks the caller even if the inner promise hangs.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  const timer = new Promise<null>((resolve) =>
    setTimeout(() => {
      console.warn(`[authStore] withTimeout: timed out after ${ms}ms`);
      resolve(null);
    }, ms)
  );
  return Promise.race([promise.then((v) => v), timer]);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...RESET_STATE,
  isInitialized: false,

  initialize: async () => {
    try {
      // ── 1. Get Supabase session (8s timeout) ────────────────────────────────
      const sessionResult = await withTimeout(
        supabase.auth.getSession(),
        8_000
      );

      const session = sessionResult?.data?.session ?? null;

      if (session) {
        set({ session, user: session.user, token: session.access_token });

        // ── 2. Fetch profile from FastAPI (12s timeout) ──────────────────────
        // CRITICAL FIX: wrap in withTimeout so a hanging API call (firewall,
        // network drop, etc.) never prevents isInitialized from being set.
        await withTimeout(get().fetchProfile(session.user.id), 12_000);
      }
    } catch (error) {
      console.error('[authStore] initialize error:', error);
    } finally {
      // ── Always set isInitialized, no matter what ─────────────────────────
      set({ isInitialized: true });
    }

    // ── 3. Listen for future auth state changes ──────────────────────────────
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[authStore] auth state change:', event);
      if (event === 'SIGNED_OUT' || !session) {
        set({ ...RESET_STATE });
        return;
      }
      if (session) {
        set({ session, user: session.user, token: session.access_token });
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await withTimeout(get().fetchProfile(session.user.id), 12_000);
        }
      }
    });
  },

  fetchProfile: async (_userId: string) => {
    set({ profileError: null });
    try {
      const res = await API.get('/auth/me');
      const userData = res.data;

      set({
        profile: userData,
        role: userData.role as 'pt' | 'client',
      });

      if (userData.role === 'client') {
        await withTimeout(get().fetchClientProfileId(), 8_000);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      console.error('[authStore] fetchProfile error:', status, e?.message);

      if (status === 404) {
        set({
          profileError: 'Account not found in database. Please contact your trainer.',
          role: null,
        });
      }
      // Network errors (no status) — silently fail.
      // role stays null → _layout.tsx redirects to login.
    }
  },

  fetchClientProfileId: async () => {
    try {
      const res = await API.get('/clients/me');
      set({ clientProfileId: res.data.id });
    } catch (err) {
      console.error('[authStore] fetchClientProfileId error:', err);
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ isLoading: false });
        return { error: error.message };
      }

      if (data.session) {
        set({
          session: data.session,
          user: data.session.user,
          token: data.session.access_token,
        });

        // Timeout guard: if the API is unreachable, don't hang the login button
        await withTimeout(get().fetchProfile(data.session.user.id), 12_000);

        const { profileError, role } = get();

        if (profileError) {
          set({ isLoading: false });
          return { error: profileError };
        }

        // If role is still null after the timeout, the API was unreachable
        if (!role) {
          set({ isLoading: false });
          return {
            error:
              'Could not reach the server. Check your connection and try again.',
          };
        }
      }

      set({ isLoading: false });
      return {};
    } catch (error: any) {
      set({ isLoading: false });
      return { error: error.message || 'Something went wrong' };
    }
  },

  logout: async () => {
    set({ ...RESET_STATE });
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('[authStore] signOut error (non-fatal):', e);
    }
    try {
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter(
        (k) =>
          k.startsWith('sb-') ||
          k.includes('supabase') ||
          k.includes('auth-token')
      );
      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys);
      }
    } catch (e) {
      console.error('[authStore] storage clear error (non-fatal):', e);
    }
  },
}));