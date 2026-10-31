import api, { unwrap } from './api';

export const authService = {
  register: async (payload) => unwrap(await api.post('/auth/register', payload)),
  login: async (payload) => unwrap(await api.post('/auth/login', payload)),
  me: async () => unwrap(await api.get('/auth/me')),
  updateProfile: async (payload) => unwrap(await api.put('/auth/profile', payload)),
};

// Chat history field name in our backend: text, role: 'user' | 'assistant'
export const aiChatService = {
  send: async (message, history = []) =>
    unwrap(await api.post('/ai/chat', { message, history })),
};

export const productService = {
  list: async (params) => unwrap(await api.get('/products', { params })),
  getById: async (id) => unwrap(await api.get(`/products/${id}`)),
};

export const cartService = {
  get: async () => unwrap(await api.get('/cart')),
  add: async (productId, quantity = 1) =>
    unwrap(await api.post('/cart/add', { productId, quantity })),
  updateQty: async (productId, quantity) =>
    unwrap(await api.patch(`/cart/${productId}`, { quantity })),
  remove: async (productId) => unwrap(await api.delete(`/cart/${productId}`)),
  clear: async () => unwrap(await api.delete('/cart/clear')),
};

export const orderService = {
  create: async (payload) => unwrap(await api.post('/orders', payload)),
  myOrders: async (params) => unwrap(await api.get('/orders/my', { params })),
  getById: async (id) => unwrap(await api.get(`/orders/${id}`)),
};

export const scanService = {
  create: async (file) => {
    const form = new FormData();
    form.append('image', file);
    const res = await api.post('/scans', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(res);
  },
  myScans: async (params) => unwrap(await api.get('/scans/my', { params })),
  getById: async (id) => unwrap(await api.get(`/scans/${id}`)),
};

export const mandiService = {
  list: async (params) => unwrap(await api.get('/mandi', { params })),
};
export const grainService = {
  list: async (params) => unwrap(await api.get('/grain', { params })),
  getById: async (id) => unwrap(await api.get(`/grain/${id}`)),
};

export const grainOrderService = {
  create: async (payload) => unwrap(await api.post('/grain-orders', payload)),
  myOrders: async (params) => unwrap(await api.get('/grain-orders/my', { params })),
};

export const adminService = {
  // Rich dashboard payload (stats + charts + recent activity)
  dashboard: async () => unwrap(await api.get('/admin/dashboard')),
  stats: async () => unwrap(await api.get('/admin/stats')),
  users: async (params) => unwrap(await api.get('/admin/users', { params })),
  user: async (id) => unwrap(await api.get(`/admin/users/${id}`)),
  deleteUser: async (id) => {
    // Keep the backend's human-readable message ({success, message, data}
    // envelope): unwrap() drops it, so merge it back for toast display.
    const res = await api.delete(`/admin/users/${id}`);
    return { ...res.data?.data, message: res.data?.message };
  },
  toggleUser: async (id) => {
    const res = await api.put(`/admin/users/${id}/toggle`);
    return { ...res.data?.data, message: res.data?.message };
  },
  allProducts: async (params) => unwrap(await api.get('/admin/products', { params })),
  uploadProductImage: async (file) => {
    const form = new FormData();
    form.append('image', file);
    const res = await api.post('/admin/uploads/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(res);
  },
  allOrders: async (params) => unwrap(await api.get('/orders/admin/all', { params })),
  updateOrderStatus: async (id, status) =>
    unwrap(await api.put(`/orders/${id}/status`, { status })),
  allScans: async (params) => unwrap(await api.get('/scans/admin/all', { params })),
  allGrains: async (params) => unwrap(await api.get('/grain/admin/all', { params })),
  allGrainOrders: async (params) =>
    unwrap(await api.get('/grain-orders/admin/all', { params })),
  updateGrainOrderStatus: async (id, status) =>
    unwrap(await api.put(`/grain-orders/${id}/status`, { status })),
  createProduct: async (payload) => unwrap(await api.post('/products', payload)),
  updateProduct: async (id, payload) => unwrap(await api.put(`/products/${id}`, payload)),
  deleteProduct: async (id) => unwrap(await api.delete(`/products/${id}`)),
  createGrain: async (payload) => unwrap(await api.post('/grain', payload)),
  updateGrain: async (id, payload) => unwrap(await api.put(`/grain/${id}`, payload)),
  deleteGrain: async (id) => unwrap(await api.delete(`/grain/${id}`)),
  createMandi: async (payload) => unwrap(await api.post('/mandi', payload)),
  updateMandi: async (id, payload) => unwrap(await api.put(`/mandi/${id}`, payload)),
};
