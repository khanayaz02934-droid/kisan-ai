import express from 'express';
import {
  placeOrder,
  getMyOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', placeOrder);
router.get('/my', getMyOrders);
router.get('/admin/all', adminOnly, getAllOrders);
router.get('/:id', getOrder);
router.put('/:id/status', adminOnly, updateOrderStatus);

export default router;
