// routes/jobRoutes.js
import express from 'express';
import {
  createJob,
  getAllJobs,
  getEmployerJobs,     
  getJobById,
  updateJob,
  updateJobStatus,      
  deleteJob,
  recommendJobs,
} from '../controllers/jobController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a new job (employer)
router.post('/', protect, authorize('employer'), createJob);

// Get all jobs (public)
router.get('/', getAllJobs);

// --- NEW: employer's own jobs (place BEFORE '/:id') ---
router.get('/mine', protect, authorize('employer'), getEmployerJobs);

// Get a single job by ID (public)
router.get('/:id', getJobById);

// Update a job (employer)
router.put('/:id', protect, authorize('employer'), updateJob);

// --- NEW: update only status (open/closed) ---
router.patch('/:id/status', protect, authorize('employer'), updateJobStatus);

// Delete a job (employer)
router.delete('/:id', protect, authorize('employer'), deleteJob);

// Recommend jobs to a jobseeker
router.post('/recommend', protect, authorize('jobseeker'), recommendJobs);

export default router;
