import axios from 'axios';
import { store } from '../redux/store';
import { logout } from '../redux/slices/authSlice';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
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
