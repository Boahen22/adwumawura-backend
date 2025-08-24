import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected route (any logged-in user)
router.get('/profile', protect, (req, res) => {
  res.status(200).json({
    message: 'User profile accessed',
    user: req.user,
  });
});

// Role-specific route (employer only)
router.get('/employer-dashboard', protect, authorize('employer'), (req, res) => {
  res.status(200).json({
    message: 'Employer dashboard accessed',
    user: req.user,
  });
});

// Role-specific route (jobseeker only)
router.get('/jobseeker-dashboard', protect, authorize('jobseeker'), (req, res) => {
  res.status(200).json({
    message: 'Jobseeker dashboard accessed',
    user: req.user,
  });
});

export default router;
