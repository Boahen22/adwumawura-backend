// middleware/uploadCv.js
// Multer setup for CV uploads. Accepts PDF, DOC, DOCX, JPG, JPEG, PNG up to 8MB.

import multer from "multer";
import path from "path";
import fs from "fs";

const ROOT = process.cwd();
const UPLOAD_DIR = path.join(ROOT, "uploads", "cv");

// Ensure destination directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const EXT_OK = new Set([".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]);
const MIME_OK = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpg",
  "image/jpeg",
  "image/png",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const stamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_ ]/gi, "")
      .replace(/\s+/g, "_");
    cb(null, `${stamp}_${base}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const okExt = EXT_OK.has(ext);
  const okMime = MIME_OK.has((file.mimetype || "").toLowerCase());
  if (!okExt || !okMime) {
    return cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "Only PDF, DOC, DOCX, JPG, JPEG, PNG files are allowed"
      )
    );
  }
  cb(null, true);
}

const uploadCv = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
});

export default uploadCv;
