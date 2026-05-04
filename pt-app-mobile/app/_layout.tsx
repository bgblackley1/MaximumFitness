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

    const inAuthGroup = segments[0] === '(pt)' || segments[0] === '(client)';

    if (!user) {
      // Not logged in, go to login
      router.replace('/login');
    } else if (user && !inAuthGroup) {
      // Logged in but not in the right group, redirect based on role
      if (role === 'pt') {
        router.replace('/(pt)/dashboard');
      } else if (role === 'client') {
        router.replace('/(client)/home');
      }
    }
  }, [user, role, isInitialized]);

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(pt)" />
      <Stack.Screen name="(client)" />
    </Stack>
  );
}