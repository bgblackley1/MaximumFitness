import axios from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/authStore';

const PRODUCTION_URL = 'https://maximumfitness-production.up.railway.app';

// ── Toggle this when testing locally ─────────────────────────────────────────
// false = dev builds hit local uvicorn (normal development)
// true  = dev builds hit Railway (use only when testing prod data locally)
const USE_PRODUCTION_IN_DEV = false;   // ← was true

const DEV_MACHINE_IP = '';

function getBaseUrl(): string {
  if (!__DEV__) return PRODUCTION_URL;           // production build → always Railway
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