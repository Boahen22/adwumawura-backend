// routes/verificationRoutes.js
import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import uploadVerificationDocs from '../middleware/uploadVerificationDocs.js';
import {
  getMyVerification,
  uploadMyVerification,
} from '../controllers/verificationController.js';

// This router only exposes employer-facing endpoints here.
// Admin endpoints remain under /api/admin/verification via a separate router.
const router = Router();

// Get current employer's verification status
router.get('/me', protect, authorize('employer'), getMyVerification);

// Upload/replace employer verification document
// Accepts a single file under field name "document"
router.post(
  '/upload',
  protect,
  authorize('employer'),
  uploadVerificationDocs.single('document'),
  uploadMyVerification
);

// Backward compatible alias (optional)
router.post(
  '/',
  protect,
  authorize('employer'),
  uploadVerificationDocs.single('document'),
  uploadMyVerification
);

export default router;
