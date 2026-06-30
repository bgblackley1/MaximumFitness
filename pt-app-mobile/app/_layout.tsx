import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import LoadingScreen from '@/components/LoadingScreen';

export default function RootLayout() {
  const { user, role, isInitialized, initialize, logout } = useAuthStore();
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const inPTGroup     = segments[0] === 'pt';
    const inClientGroup = segments[0] === 'client';
    const inAuthGroup   = inPTGroup || inClientGroup;
    const atLogin       = segments[0] === 'login';

    // ── Not logged in ────────────────────────────────────────────────────────
    if (!user) {
      if (!atLogin) router.replace('/login');
      return;
    }

    // ── Logged in but role could not be loaded (not in FastAPI DB) ───────────
    // E.g. client created before the fix was applied.
    // Log them out so they see the login screen with an error from the login attempt.
    if (!role) {
      // Don't loop — only act if not already going to login
      if (!atLogin) {
        logout().catch(console.error);
        router.replace('/login');
      }
      return;
    }

    // ── Logged in as PT but on client route → send to PT home ────────────────
    if (role === 'pt' && inClientGroup) {
      router.replace('/pt/dashboard');
      return;
    }

    // ── Logged in as client but on PT route → send to client home ────────────
    if (role === 'client' && inPTGroup) {
      router.replace('/client/home');
      return;
    }

    // ── Logged in but at root/login → send to role home ──────────────────────
    if (!inAuthGroup) {
      if (role === 'pt')     router.replace('/pt/dashboard');
      else if (role === 'client') router.replace('/client/home');
    }
  }, [user, role, isInitialized, segments[0]]);

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="pt" />
      <Stack.Screen name="client" />
    </Stack>
  );
}