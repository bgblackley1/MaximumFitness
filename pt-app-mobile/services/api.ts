import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

/**
 * URL strategy:
 *
 *  Android physical device via USB + `adb reverse tcp:8000 tcp:8000`
 *    → http://127.0.0.1:8000   (USB tunnel maps phone localhost → PC port 8000)
 *
 *  Android emulator (no USB)
 *    → http://10.0.2.2:8000    (emulator special alias for host machine)
 *
 *  iOS simulator / web
 *    → http://127.0.0.1:8000
 *
 *  Real device on WiFi only (no USB)
 *    → set WIFI_FALLBACK_IP to your laptop's LAN IP e.g. '192.168.55.189'
 */

// Only needed if testing over WiFi without USB — leave empty when using USB
const WIFI_FALLBACK_IP = '';

function getBaseUrl(): string {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      // USB + adb reverse → use localhost directly
      // If not using USB, fall back to LAN IP or emulator alias
      if (WIFI_FALLBACK_IP) return `http://${WIFI_FALLBACK_IP}:8000`;
      return 'http://127.0.0.1:8000'; // works when adb reverse is active
    }
  }
  return 'http://127.0.0.1:8000';
}

const API = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
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