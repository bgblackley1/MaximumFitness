import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import LoadingScreen from '@/components/LoadingScreen';

export default function RootLayout() {
  const { user, role, isInitialized, initialize } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const inPTGroup     = segments[0] === 'pt';
    const inClientGroup = segments[0] === 'client';
    const inAuthGroup   = inPTGroup || inClientGroup;

    if (!user) {
      // Not logged in → login
      if (segments[0] !== 'login') {
        router.replace('/login');
      }
      return;
    }

    // Logged in but wrong role for route → redirect to correct home
    if (role === 'pt' && inClientGroup) {
      router.replace('/pt/dashboard');
      return;
    }
    if (role === 'client' && inPTGroup) {
      router.replace('/client/home');
      return;
    }

    // Logged in but at root or login page → go to role home
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