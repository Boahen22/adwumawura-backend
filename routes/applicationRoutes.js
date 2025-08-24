import express from "express";
import {
  applyForJob,
  getApplicationsForJob,
  getMyApplications,
  updateApplicationStatus,
} from "../controllers/applicationController.js";
import { protect } from "../middleware/authMiddleware.js";
import uploadCv from "../middleware/uploadCv.js";

const router = express.Router();

// Jobseeker applies for a job (optional CV under field name "cv")
router.post("/:jobId", protect, uploadCv.single("cv"), applyForJob);

// Backward-compatible alias if some clients use /jobs/:jobId/apply
router.post("/jobs/:jobId/apply", protect, uploadCv.single("cv"), applyForJob);

// Employer views applications for their job
router.get("/job/:jobId", protect, getApplicationsForJob);

// Jobseeker views their own applications
router.get("/my", protect, getMyApplications);

// Employer updates application status
router.put("/:applicationId/status", protect, updateApplicationStatus);

export default router;
