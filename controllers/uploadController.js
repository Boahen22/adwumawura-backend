// controllers/uploadController.js
// Handles single-file uploads to Cloudinary.
// Expects multipart/form-data with field name: "file"

import fs from "fs";
import path from "path";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";

// --- Multer temp storage (disk) ---
const TEMP_DIR = path.join(process.cwd(), "uploads", "tmp");
fs.mkdirSync(TEMP_DIR, { recursive: true });

const upload = multer({
  dest: TEMP_DIR,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export const uploadMiddleware = upload.single("file");

// --- Controller: upload to Cloudinary ---
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "adwumawura",       // folder name in your Cloudinary media library
      resource_type: "image",     // change to "auto" if you’ll allow PDFs/videos later
      overwrite: false,
    });

    // Clean up temp file
    try { fs.unlinkSync(req.file.path); } catch {}

    // Respond with the important bits for your frontend/DB
    return res.json({
      public_id: result.public_id,
      secure_url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Upload failed",
      error: err.message,
    });
  }
};
