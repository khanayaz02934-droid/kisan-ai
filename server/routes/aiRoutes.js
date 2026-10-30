import express from 'express';
import rateLimit from 'express-rate-limit';
import { sendChat } from '../controllers/aiChatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Chat-specific limiter: 30 messages / 15 min per user (AI provider quota guard)
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: {
    success: false,
    message:
      'Too many chat messages. Limit is 30 per 15 minutes. / बहुत अधिक संदेश। सीमा प्रति 15 मिनट 30 है।',
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(protect);

// @route   POST /api/ai/chat
router.post('/chat', chatLimiter, sendChat);

export default router;
