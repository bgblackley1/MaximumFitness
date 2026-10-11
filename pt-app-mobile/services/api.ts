import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

// ─────────────────────────────────────────────────────────────────────────────
// ⚙️  SET THIS to your laptop's WiFi IP address (check with `ipconfig` on
//    Windows or `ifconfig | grep "inet "` on Mac).
//    Example: '192.168.1.42'
//
//    Leave as empty string '' to auto-select based on platform (emulator/web).
// ─────────────────────────────────────────────────────────────────────────────
const DEV_MACHINE_IP = '192.168.55.189';   // ← PUT YOUR LAPTOP IP HERE e.g. '192.168.1.42'

function getBaseUrl(): string {
  if (__DEV__) {
    // Real device via Expo Go — use the manually set laptop LAN IP
    if (DEV_MACHINE_IP) {
      return `http://${DEV_MACHINE_IP}:8000`;
    }

    // Android emulator: 10.0.2.2 routes to the host machine's localhost
    if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  }

  // iOS simulator, web, or production
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