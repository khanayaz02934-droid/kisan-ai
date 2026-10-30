import { createSlice } from '@reduxjs/toolkit';

const tokenFromStorage = localStorage.getItem('kisan_token');
const userFromStorage = (() => {
  try {
    return JSON.parse(localStorage.getItem('kisan_user') || 'null');
  } catch {
    return null;
  }
})();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: userFromStorage,
    token: tokenFromStorage || null,
    isAuthenticated: Boolean(tokenFromStorage),
  },
  reducers: {
    setCredentials: (state, action) => {
      const { user, token } = action.payload || {};
      state.user = user || null;
      state.token = token || null;
      state.isAuthenticated = Boolean(token);
      if (token) localStorage.setItem('kisan_token', token);
      if (user) localStorage.setItem('kisan_user', JSON.stringify(user));
    },
    setUser: (state, action) => {
      state.user = action.payload;
      if (action.payload) localStorage.setItem('kisan_user', JSON.stringify(action.payload));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('kisan_token');
      localStorage.removeItem('kisan_user');
    },
  },
});

export const { setCredentials, setUser, logout } = authSlice.actions;
export default authSlice.reducer;
