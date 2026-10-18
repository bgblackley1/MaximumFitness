import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

// ── Production backend URL ─────────────────────────────────────────────────
// Once your backend is deployed, paste the public URL here.
// Leave DEV_MACHINE_IP for local development.
const PRODUCTION_URL = 'https://your-app.up.railway.app'; // ← SET THIS

// ── Dev machine IP for local testing (USB + adb reverse) ──────────────────
const DEV_MACHINE_IP = '';  // Leave empty when using adb reverse

function getBaseUrl(): string {
  if (!__DEV__) {
    // Production build — always use the deployed backend
    return PRODUCTION_URL;
  }

  // Development build
  if (DEV_MACHINE_IP) return `http://${DEV_MACHINE_IP}:8000`;
  if (Platform.OS === 'android') return 'http://127.0.0.1:8000'; // adb reverse
  return 'http://127.0.0.1:8000';
}

const API = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
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