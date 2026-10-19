import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

// ── Your deployed Railway URL ────────────────────────────────────────────────
const PRODUCTION_URL = 'https://maximumfitness-production.up.railway.app'; // ← added https://

// ── Set to true to force Railway even during local dev ───────────────────────
const USE_PRODUCTION_IN_DEV = true;

// ── Dev machine IP (only needed for WiFi testing without USB) ────────────────
const DEV_MACHINE_IP = '';

function getBaseUrl(): string {
  if (!__DEV__) return PRODUCTION_URL;
  if (USE_PRODUCTION_IN_DEV) return PRODUCTION_URL;
  if (DEV_MACHINE_IP) return `http://${DEV_MACHINE_IP}:8000`;
  if (Platform.OS === 'android') return 'http://127.0.0.1:8000';
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