import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: any | null;
  profile: any | null;
  role: 'pt' | 'client' | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  role: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await get().fetchProfile(session.user.id);
        set({ session, user: session.user });
      }
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      set({ isInitialized: true });
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await get().fetchProfile(session.user.id);
        set({ session, user: session.user });
      } else {
        set({ session: null, user: null, profile: null, role: null });
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
      // ← ADD THIS so you can see errors in the console
      console.error('fetchProfile error:', JSON.stringify(error, null, 2));
      return;
    }

    if (data) {
      set({ profile: data, role: data.role as 'pt' | 'client' });
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
        await get().fetchProfile(data.session.user.id);
        set({ session: data.session, user: data.session.user, isLoading: false });
      }

      return {};
    } catch (error: any) {
      set({ isLoading: false });
      return { error: error.message || 'Something went wrong' };
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, role: null });
  },
}));