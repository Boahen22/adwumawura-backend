// routes/adminVerificationRoutes.js
import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
  adminListVerifications,
  adminGetVerification,
  adminDownloadFile,
  adminUpdateStatus,
} from '../controllers/verificationController.js';

const router = Router();

// List all submissions with optional filters
router.get('/list', protect, authorize('admin'), adminListVerifications);

// Get a single submission
router.get('/:id', protect, authorize('admin'), adminGetVerification);

// Stream the uploaded file
router.get('/:id/file', protect, authorize('admin'), adminDownloadFile);

// Approve/reject/pending with optional note
router.patch('/:id/status', protect, authorize('admin'), adminUpdateStatus);

export default router;
