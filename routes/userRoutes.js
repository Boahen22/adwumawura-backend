// routes/userRoutes.js
import express from 'express';
import {
  registerUser,
  loginUser,
  getMyProfile,
  updateMyProfile,
  updateMyPassword,
  uploadVerificationDocs as uploadVerificationDocsHandler,
  getAllEmployersForReview,
  updateEmployerVerificationStatus,
  getMyVerificationStatus,
} from '../controllers/userController.js';

import upload from '../middleware/uploadVerificationDocs.js';
import { protect, isAdmin, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public auth
router.post('/register', registerUser);
router.post('/login', loginUser);

// Optional safe aliases if frontend ever calls /api/users/auth/*
router.post('/auth/register', registerUser);
router.post('/auth/login', loginUser);

// Profile
router.get('/profile', protect, getMyProfile);
router.put('/profile', protect, updateMyProfile);
router.put('/password', protect, updateMyPassword);

// Employer dashboard (examples kept)
router.get('/employer-dashboard', protect, authorize('employer'), (req, res) => {
  res.status(200).json({ message: 'Employer dashboard accessed', user: req.user });
});

// Jobseeker dashboard (examples kept)
router.get('/jobseeker-dashboard', protect, authorize('jobseeker'), (req, res) => {
  res.status(200).json({ message: 'Jobseeker dashboard accessed', user: req.user });
});

// Employer: upload verification docs (PDF/JPG/PNG up to 8MB, max 5)
router.post(
  '/verify',
  protect,
  authorize('employer'),
  upload.array('documents', 5),
  uploadVerificationDocsHandler
);

// Employer: check own verification status
router.get('/verify/status', protect, authorize('employer'), getMyVerificationStatus);

// Admin: list employers for review
router.get('/employers', protect, isAdmin, getAllEmployersForReview);

// Admin: update employer verification status
router.put('/employers/:id/verify', protect, isAdmin, updateEmployerVerificationStatus);

export default router;
