// routes/uploadRoutes.js
import { Router } from "express";
import { uploadMiddleware, uploadImage } from "../controllers/uploadController.js";

const router = Router();

// POST /api/upload  (multipart/form-data with key: "file")
router.post("/", uploadMiddleware, uploadImage);

export default router;
