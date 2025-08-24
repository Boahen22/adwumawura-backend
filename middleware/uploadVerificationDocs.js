// middleware/uploadVerificationDocs.js
// Multer configuration for employer verification uploads.

import multer from 'multer';
import path from 'path';
import fs from 'fs';

const ROOT = process.cwd();
const UPLOAD_DIR = path.join(ROOT, 'uploads', 'verification');

// Ensure destination exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_EXT = ['.pdf', '.png', '.jpg', '.jpeg'];
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpg',
  'image/jpeg',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const stamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_ ]/gi, '')
      .replace(/\s+/g, '_');
    cb(null, `${stamp}_${base}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const okExt = ALLOWED_EXT.includes(ext);
  const okMime = ALLOWED_MIME.has((file.mimetype || '').toLowerCase());
  if (!okExt || !okMime) {
    return cb(
      new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        'Only PDF, JPG, JPEG, PNG files are allowed'
      )
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
});

// Export the multer instance and keep helpers available
const uploadVerificationDocs = upload;
export default uploadVerificationDocs;
export { upload as baseUpload };
