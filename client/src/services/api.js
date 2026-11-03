import axios from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/slices/authSlice';

/**
 * Single place for the API base URL.
 * Priority:
 *   1. VITE_API_URL        — recommended env var (set in Vercel/`.env.local`)
 *   2. VITE_API_BASE_URL   — legacy name kept for backward compatibility
 *   3. Production default  — the deployed Render API, so a deploy without the
 *      env var can never silently point at localhost ("Network Error")
 *   4. Dev default         — local Vite dev server + local backend
 */
const PROD_BASE_URL = 'https://kisan-ai-1-7ilu.onrender.com/api';
const DEV_BASE_URL = 'http://localhost:5000/api';
const baseURL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? PROD_BASE_URL : DEV_BASE_URL);

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const state = store.getState();
    const token = state?.auth?.token || localStorage.getItem('kisan_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const url = error?.config?.url || '';
      const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthRoute) {
        store.dispatch(logout());
      }
    }
    return Promise.reject(error);
  }
);

// Backend envelope is always { success, message, data }. Unwrap data here.
export const unwrap = (res) => res?.data?.data;

export const apiErrorMessage = (error, fallback = 'Something went wrong') => {
  return error?.response?.data?.message || error?.message || fallback;
};

export default api;
