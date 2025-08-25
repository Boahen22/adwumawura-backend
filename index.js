// index.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import connectDB from './config/db.js';
import multer from 'multer';

// Route imports
import authRoutes from './routes/authRoutes.js';
import protectedRoutes from './routes/protectedRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

// Verification routes
import verificationRoutes from './routes/verificationRoutes.js';
import adminVerificationRoutes from './routes/adminVerificationRoutes.js';

// Upload route (Cloudinary)
import uploadRoutes from './routes/uploadRoutes.js';

// Optional aliases for /api/auth/*
import { registerUser, loginUser } from './controllers/userController.js';

dotenv.config();

const app = express();

// Database connection
connectDB();

// Put your Netlify site URL in Render env as CLIENT_URL (or NETLIFY_URL).
// Example: https://lively-crumble-30443e.netlify.app
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.NETLIFY_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser clients (no Origin header), e.g. curl/Postman
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // cache preflight for a day
  })
);

// Make sure preflight requests are handled
app.options('*', cors());

/* ------------------------------------------------------------------ */

// JSON parser (safe with multer; multipart bypasses this)
app.use(express.json());

// Serve uploaded files statically
const __dirname = path.resolve();
app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

// Health checks
app.get('/', (_req, res) => res.send('Adwumawura Backend API is running'));
app.get('/health', (_req, res) =>
  res.json({ ok: true, time: new Date().toISOString() })
);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Verification routes (employer + admin)
app.use('/api/verification', verificationRoutes);
app.use('/api/admin/verification', adminVerificationRoutes);

// Upload route (multipart/form-data -> Cloudinary)
app.use('/api/upload', uploadRoutes);

// Helper aliases (if your authRoutes already define these, this is harmless)
app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);

// Multer-specific error handler (friendly messages)
app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    let msg = err.message || 'Upload failed';
    if (err.code === 'LIMIT_FILE_SIZE') msg = 'File too large (max 8MB)';
    if (err.code === 'LIMIT_FILE_COUNT') msg = 'Too many files (max 5)';
    if (err.code === 'LIMIT_UNEXPECTED_FILE' && err.field) msg = String(err.field);
    return res.status(400).json({ message: `Upload error: ${msg}` });
  }
  return next(err);
});

// Generic error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Server error' });
});

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
