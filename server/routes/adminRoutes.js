import express from 'express';
import {
  getDashboard,
  getDashboardStats,
  getAllUsers,
  getUser,
  deleteUser,
  toggleUserStatus,
  uploadImage,
} from '../controllers/adminController.js';
import { getAdminProducts } from '../controllers/productController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/roleMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Every route below requires a valid JWT plus the ADMIN role.
router.use(protect, adminOnly);

// Dashboard
router.get('/dashboard', getDashboard);
router.get('/stats', getDashboardStats); // legacy compact stats (kept for compatibility)

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUser);
router.put('/users/:id/toggle', toggleUserStatus);
router.delete('/users/:id', deleteUser);

// Product management (admin list includes unavailable products;
// create/update/delete keep using the existing /api/products admin routes)
router.get('/products', getAdminProducts);

// Product image upload (multipart/form-data, field name: "image")
router.post('/uploads/image', upload.single('image'), uploadImage);

export default router;
