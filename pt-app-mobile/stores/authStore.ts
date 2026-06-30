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

  fetchProfile: async (_userId: string) => {
    // ── FIXED: Read role from FastAPI /auth/me, NOT from Supabase profiles table.
    // Supabase profiles table is NOT populated for admin-created client accounts,
    // so reading from there always returns the wrong role (or null).
    // Our FastAPI users table is the single source of truth for roles.
    set({ profileError: null });
    try {
      const res = await API.get('/auth/me');
      const userData = res.data; // { id, email, name, role, ... }

      set({
        profile: userData,
        role: userData.role as 'pt' | 'client',
      });

      if (userData.role === 'client') {
        await get().fetchClientProfileId();
      }
    } catch (e: any) {
      const status = e?.response?.status;
      console.error('fetchProfile error:', status, e?.message);

      if (status === 404) {
        // User authenticated in Supabase but not in FastAPI DB.
        // This happens if client was created before the client_service fix.
        set({
          profileError: 'Account not found in database. Please contact your trainer.',
          role: null,
        });
      }
      // Don't set role — _layout.tsx will handle null role by redirecting to login
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

        // If profile fetch failed (404), return error so login screen shows it
        const { profileError } = get();
        if (profileError) {
          set({ isLoading: false });
          return { error: profileError };
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
      console.error('SignOut error (non-fatal):', e);
    }
    try {
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter(
        (k) => k.startsWith('sb-') || k.includes('supabase') || k.includes('auth-token')
      );
      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys);
      }
    } catch (e) {
      console.error('Storage clear error (non-fatal):', e);
    }
  },
}));