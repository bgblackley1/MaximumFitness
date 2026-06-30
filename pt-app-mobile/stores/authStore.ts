import { create } from 'zustand';
import { supabase } from '../services/supabase';
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
};

export const useAuthStore = create<AuthState>((set, get) => ({
  ...RESET_STATE,
  isInitialized: false,

  initialize: async () => {
    try {
      const sessionPromise = supabase.auth.getSession();
      const timeout = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      );
      const { data: { session } } = await Promise.race([sessionPromise, timeout])
        .catch(() => ({ data: { session: null } }));

      if (session) {
        set({ session, user: session.user, token: session.access_token });
        await get().fetchProfile(session.user.id);
      }
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      set({ isInitialized: true });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event);
      if (event === 'SIGNED_OUT' || !session) {
        set({ ...RESET_STATE });
        return;
      }
      if (session) {
        set({ session, user: session.user, token: session.access_token });
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await get().fetchProfile(session.user.id);
        }
      }
    });
  },

  fetchProfile: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('fetchProfile error:', error.message);
        return;
      }

      if (data) {
        set({ profile: data, role: data.role as 'pt' | 'client' });
        if (data.role === 'client') {
          await get().fetchClientProfileId();
        }
      }
    } catch (e) {
      console.error('fetchProfile exception:', e);
    }
  },

  fetchClientProfileId: async () => {
    try {
      const res = await API.get('/clients/me');
      set({ clientProfileId: res.data.id });
    } catch (err) {
      console.error('fetchClientProfileId error:', err);
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
        await get().fetchProfile(data.session.user.id);
      }
      set({ isLoading: false });
      return {};
    } catch (error: any) {
      set({ isLoading: false });
      return { error: error.message || 'Something went wrong' };
    }
  },

  logout: async () => {
    // Clear state immediately so UI responds instantly
    set({ ...RESET_STATE });
    try {
      // scope: 'local' clears this device only — faster and more reliable
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('SignOut error (non-fatal):', e);
    }
  },
}));