
import './config/loadEnv.js';
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

// Initialize Express
const app = express();

// Connect MongoDB
connectDB();

// Trust Render proxy
app.set('trust proxy', 1);

// Security Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

// ---------------------------------------------------------------------------
// CORS Configuration
// ---------------------------------------------------------------------------
// Origins that are allowed to call this API:
//  - https://kisan-ai-seven.vercel.app  → production frontend (Vercel)
//  - http://localhost:5173              → Vite dev server
//  - process.env.CLIENT_URL             → set on Render (must be the exact
//    Vercel production origin, no trailing slash)
const allowedOrigins = [
  'https://kisan-ai-seven.vercel.app',
  'http://localhost:5173',
  process.env.CLIENT_URL,
]
  .filter(Boolean) // ignore unset CLIENT_URL instead of keeping '' entries
  .map((origin) => origin.trim().replace(/\/+$/, '')) // normalize: no trailing slash
  .filter((origin, i, list) => list.indexOf(origin) === i); // no duplicates

console.log('Allowed CORS Origins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without an Origin header (curl, Render health checks,
      // same-origin requests) are allowed.
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/+$/, '');

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      console.error('CORS blocked origin:', origin);

      // Reject disallowed origins with a proper 403 instead of a 500.
      // The browser blocks the response anyway; this keeps logs accurate.
      const err = new Error('CORS: Origin not allowed');
      err.status = 403;
      return callback(err);
    },
    // The axios client sends withCredentials: true, so this MUST stay true.
    // Pairing credentials: true with explicit origins (never '*') is required.
    credentials: true,
    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
    // The cors middleware answers OPTIONS preflights itself (default 204).
    preflightContinue: false,
    optionsSuccessStatus: 204,
    // Cache preflight result for 10 minutes to cut down on OPTIONS requests.
    maxAge: 600,
  })
);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
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

// Root Route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Kisan AI API is running successfully',
    data: {
      status: 'online',
    },
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Kisan AI Server is running',
    data: {
      status: 'online',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    },
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

// 404 Handler
app.use(notFound);

// Global Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60).green.bold);
  console.log('  KISAN AI SERVER STARTED'.green.bold);
  console.log('='.repeat(60).green.bold);
  console.log(`  Port    : ${PORT}`.cyan);
  console.log(`  Mode    : ${process.env.NODE_ENV || 'development'}`.cyan);
  console.log(`  CORS    : ${allowedOrigins.join(', ')}`.cyan);
  console.log('='.repeat(60).green.bold);
  console.log('');
});

export default app;
