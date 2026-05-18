import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const { user, role } = useAuthStore();

  if (!user) return <Redirect href="/login" />;
  if (role === 'pt') return <Redirect href="/pt/dashboard" />;
  if (role === 'client') return <Redirect href="/client/home" />;

  return <Redirect href="/login" />;
}