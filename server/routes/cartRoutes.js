import express from 'express';
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../controllers/cartController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCart);
router.post('/add', addToCart);
router.patch('/:productId', updateCartItem);
router.delete('/clear', clearCart);
router.delete('/:productId', removeFromCart);

export default router;
