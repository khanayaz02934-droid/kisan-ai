import express from 'express';
import { createScan, getMyScans, getScan, getAllScans } from '../controllers/scanController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/roleMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Scan-specific rate limiter: 20/hour per user
const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: {
    success: false,
    message: 'Too many scans. Limit is 20 per hour. / बहुत अधिक स्कैन। सीमा प्रति घंटे 20 है।',
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(protect);

router.post('/', scanLimiter, upload.single('image'), createScan);
router.get('/admin/all', adminOnly, getAllScans);
router.get('/my', getMyScans);
router.get('/:id', getScan);

export default router;
