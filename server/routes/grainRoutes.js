import express from 'express';
import {
  getGrains,
  getAllGrainsAdmin,
  getGrain,
  createGrain,
  updateGrain,
  deleteGrain,
} from '../controllers/grainController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', getGrains);
router.get('/admin/all', protect, adminOnly, getAllGrainsAdmin);
router.get('/:id', getGrain);
router.post('/', protect, adminOnly, createGrain);
router.put('/:id', protect, adminOnly, updateGrain);
router.delete('/:id', protect, adminOnly, deleteGrain);

export default router;
