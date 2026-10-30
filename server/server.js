import './config/loadEnv.js';
// Validate required env vars and fail fast with a clear message.
import './config/validateEnv.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import colors from 'colors';

import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import scanRoutes from './routes/scanRoutes.js';
import mandiRoutes from './routes/mandiRoutes.js';
import grainRoutes from './routes/grainRoutes.js';
import grainOrderRoutes from './routes/grainOrderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

// Connect to MongoDB
connectDB();

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    data: null,
  },
});
app.use(globalLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Kisan AI Server is running 🌱',
    data: { timestamp: new Date().toISOString(), env: process.env.NODE_ENV },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/mandi', mandiRoutes);
app.use('/api/grain', grainRoutes);
app.use('/api/grain-orders', grainOrderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60).green.bold);
  console.log(`  🌱 KISAN AI SERVER STARTED`.green.bold);
  console.log('='.repeat(60).green.bold);
  console.log(`  Port    : ${PORT}`.cyan);
  console.log(`  Mode    : ${process.env.NODE_ENV || 'development'}`.cyan);
  console.log(`  URL     : http://localhost:${PORT}`.cyan);
  console.log('='.repeat(60).green.bold);
  console.log('');
});

export default app;
