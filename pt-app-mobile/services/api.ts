import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

// ── Production backend URL ─────────────────────────────────────────────────
// Once your backend is deployed, paste the public URL here.
// Leave DEV_MACHINE_IP for local development.
const PRODUCTION_URL = 'maximumfitness-production.up.railway.app'; // ← SET THIS

// ── Dev machine IP for local testing (USB + adb reverse) ──────────────────
const DEV_MACHINE_IP = '';  // Leave empty when using adb reverse

// Temporary test — force Railway even in dev
function getBaseUrl(): string {
  return PRODUCTION_URL;
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