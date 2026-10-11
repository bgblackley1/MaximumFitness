import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

/**
 * Auto-detects the correct backend URL for each environment:
 *
 *  Real device via Expo Go  → http://<your-laptop-LAN-IP>:8000
 *  Android emulator         → http://10.0.2.2:8000
 *  iOS simulator / web      → http://127.0.0.1:8000
 *
 * Expo exposes the Metro server's host through its runtime manifest.
 * We strip the Metro port (8081) and replace it with the API port (8000).
 */
function getBaseUrl(): string {
  if (__DEV__) {
    // Try each location Expo has used across SDK versions for the runtime host.
    // One of these will contain "192.168.x.x:8081" when running in Expo Go.
    const hostUri: string =
      (Constants as any).manifest2?.extra?.expoClient?.hostUri ?? // SDK 46+ Expo Go
      (Constants as any).manifest?.hostUri ??                     // Legacy Expo Go
      (Constants as any).manifest?.debuggerHost ??                // Older fallback
      '';

    const host = hostUri.split(':')[0]; // strip the ":8081" port

    if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '') {
      // Real device via Expo Go — use the laptop's LAN IP
      return `http://${host}:8000`;
    }

    // Android emulator: 10.0.2.2 maps to the host machine's 127.0.0.1
    if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  }

  // iOS simulator, web, or fallback
  return 'http://127.0.0.1:8000';
}

const API = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  // ← CRITICAL: Without this, a failed/unreachable request hangs forever.
  // This was the direct cause of the infinite white loading screen on mobile.
  timeout: 10_000, // 10 seconds
});

API.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default API;