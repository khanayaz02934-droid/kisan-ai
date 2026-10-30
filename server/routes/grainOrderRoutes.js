import express from 'express';
import {
  placeGrainOrder,
  getMyGrainOrders,
  getAllGrainOrders,
  updateGrainOrderStatus,
} from '../controllers/grainOrderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', placeGrainOrder);
router.get('/my', getMyGrainOrders);
router.get('/admin/all', adminOnly, getAllGrainOrders);
router.put('/:id/status', adminOnly, updateGrainOrderStatus);

export default router;
