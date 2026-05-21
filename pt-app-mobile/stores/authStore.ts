import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/supabase-js';
import API from '../services/api';

interface AuthState {
  session: Session | null;
  user: any | null;
  profile: any | null;
  role: 'pt' | 'client' | null;
  token: string | null;               // ← FIX: was missing, broke all API calls
  clientProfileId: string | null;    // ← NEW: ClientProfile.id for client users
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  fetchClientProfileId: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  role: null,
  token: null,
  clientProfileId: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
      if (session) {
        set({ session, user: session.user, token: session.access_token });
        await get().fetchProfile(session.user.id);
      } else {
        set({
          session: null, user: null, profile: null,
          role: null, token: null, clientProfileId: null,
        });
      }
    });
  },

  fetchProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('fetchProfile error:', JSON.stringify(error, null, 2));
      return;
    }

    if (data) {
      set({ profile: data, role: data.role as 'pt' | 'client' });
      if (data.role === 'client') {
        await get().fetchClientProfileId();
      }
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
        set({ isLoading: false });
      }
      return {};
    } catch (error: any) {
      set({ isLoading: false });
      return { error: error.message || 'Something went wrong' };
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({
      session: null, user: null, profile: null,
      role: null, token: null, clientProfileId: null,
    });
  },
}));