import express from 'express';
import { getMandiList, addMandiPrice, updateMandiPrice } from '../controllers/mandiController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', getMandiList);
router.post('/', protect, adminOnly, addMandiPrice);
router.put('/:id', protect, adminOnly, updateMandiPrice);

export default router;
