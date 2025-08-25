// controllers/verificationController.js
import fs from 'fs';
import EmployerVerification from '../models/EmployerVerification.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// Map platform status to user-facing status
function mapToUserStatus(platformStatus) {
  if (platformStatus === 'approved') return 'passed verification';
  if (platformStatus === 'rejected') return 'failed verification';
  return 'under review';
}

// Keep user verification flags in sync
async function applyStatusToUser(userId, platformStatus) {
  const userStatus = mapToUserStatus(platformStatus);
  const updates = {
    verificationStatus: userStatus,
    isVerified: userStatus === 'passed verification',
  };
  await User.findByIdAndUpdate(userId, updates, { new: true });
}

// ===== Employer endpoints =====

// GET /api/verification/me
export async function getMyVerification(req, res) {
  try {
    const [v, user] = await Promise.all([
      EmployerVerification.findOne({ employer: req.user._id }),
      User.findById(req.user._id).select('verificationStatus isVerified'),
    ]);

    if (!v) {
      return res.json({
        status: 'unverified',
        userVerificationStatus: user?.verificationStatus || 'under review',
        isVerified: Boolean(user?.isVerified),
        note: '',
        submittedAt: null,
        updatedAt: null,
        documentUrl: '', // present but empty when none
      });
    }

    return res.json({
      status: v.status,
      userVerificationStatus: user?.verificationStatus || mapToUserStatus(v.status),
      isVerified: Boolean(user?.isVerified),
      note: v.note || '',
      submittedAt: v.submittedAt,
      updatedAt: v.updatedAt,
      documentUrl: v.documentUrl || '', // include if your schema stores it
    });
  } catch (e) {
    console.error('getMyVerification error:', e);
    res.status(500).json({ message: 'Failed to load verification.' });
  }
}

// POST /api/verification/upload
export async function uploadMyVerification(req, res) {
  try {
    const file = req.file || (Array.isArray(req.files) && req.files[0]);
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Optional: support a URL captured from the Cloudinary-backed /api/upload
    const documentUrl =
      (req.body && (req.body.documentUrl || req.body.url || req.body.secure_url)) || '';

    const meta = {
      employer: req.user._id,
      status: 'pending',
      note: '',
      filePath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      submittedAt: new Date(),
      updatedAt: new Date(),
      ...(documentUrl ? { documentUrl } : {}), // saved if your schema supports it
    };

    const existing = await EmployerVerification.findOne({ employer: req.user._id });
    if (existing) {
      // Clean up previously stored local file if it exists
      if (existing.filePath && fs.existsSync(existing.filePath)) {
        try {
          fs.unlinkSync(existing.filePath);
        } catch {}
      }
      Object.assign(existing, meta);
      await existing.save();
    } else {
      await EmployerVerification.create(meta);
    }

    await applyStatusToUser(req.user._id, 'pending');

    // Notify the employer (best-effort)
    try {
      await Notification.create({
        recipient: req.user._id,
        type: 'info',
        message: 'Your verification document was submitted and is pending review.',
        meta: { action: 'verification_upload' },
      });
    } catch {}

    res.json({ message: 'Uploaded. Pending review.' });
  } catch (e) {
    console.error('uploadMyVerification error:', e);
    res.status(500).json({ message: 'Upload failed.' });
  }
}

// ===== Admin endpoints =====

// GET /api/admin/verification/list?status=&search=&page=&pageSize=
export async function adminListVerifications(req, res) {
  try {
    const { status, search, page = 1, pageSize = 20 } = req.query;

    const q = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      q.status = status;
    }

    const pipeline = [{ $match: q }, { $sort: { updatedAt: -1 } }];

    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'employer',
          foreignField: '_id',
          as: 'employerDoc',
        },
      },
      { $unwind: '$employerDoc' }
    );

    if (search) {
      const rx = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [{ 'employerDoc.name': rx }, { 'employerDoc.email': rx }],
        },
      });
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    pipeline.push({ $skip: skip }, { $limit: Number(pageSize) });

    const [list, count] = await Promise.all([
      EmployerVerification.aggregate(pipeline),
      EmployerVerification.countDocuments(q),
    ]);

    res.json({
      data: list.map((v) => ({
        id: v._id,
        status: v.status,
        note: v.note || '',
        submittedAt: v.submittedAt,
        updatedAt: v.updatedAt,
        employer: {
          id: v.employerDoc._id,
          name: v.employerDoc.name || '',
          email: v.employerDoc.email || '',
        },
        file: { name: v.originalName, mime: v.mimeType, size: v.size },
        documentUrl: v.documentUrl || '',
      })),
      page: Number(page),
      pageSize: Number(pageSize),
      total: count,
    });
  } catch (e) {
    console.error('adminListVerifications error:', e);
    res.status(500).json({ message: 'Failed to list verifications.' });
  }
}

// GET /api/admin/verification/:id
export async function adminGetVerification(req, res) {
  try {
    const v = await EmployerVerification.findById(req.params.id).populate(
      'employer',
      'name email verificationStatus isVerified'
    );
    if (!v) return res.status(404).json({ message: 'Not found' });

    res.json({
      id: v._id,
      status: v.status,
      note: v.note || '',
      submittedAt: v.submittedAt,
      updatedAt: v.updatedAt,
      employer: {
        id: v.employer._id,
        name: v.employer.name || '',
        email: v.employer.email || '',
        isVerified: Boolean(v.employer.isVerified),
        verificationStatus: v.employer.verificationStatus || mapToUserStatus(v.status),
      },
      file: { name: v.originalName, mime: v.mimeType, size: v.size },
      documentUrl: v.documentUrl || '',
    });
  } catch (e) {
    console.error('adminGetVerification error:', e);
    res.status(500).json({ message: 'Failed to load verification.' });
  }
}

// GET /api/admin/verification/:id/file
export async function adminDownloadFile(req, res) {
  try {
    const v = await EmployerVerification.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Not found' });
    if (!v.filePath || !fs.existsSync(v.filePath)) {
      return res.status(404).json({ message: 'File missing' });
    }

    res.setHeader('Content-Type', v.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(v.originalName)}"`
    );
    fs.createReadStream(v.filePath).pipe(res);
  } catch (e) {
    console.error('adminDownloadFile error:', e);
    res.status(500).json({ message: 'Download failed.' });
  }
}

// PATCH /api/admin/verification/:id/status
export async function adminUpdateStatus(req, res) {
  try {
    const { status, note = '' } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const v = await EmployerVerification.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Not found' });

    v.status = status;
    v.note = note;
    v.updatedAt = new Date();
    await v.save();

    await applyStatusToUser(v.employer, status);

    try {
      const type = status === 'approved' ? 'success' : status === 'rejected' ? 'warning' : 'info';
      const message =
        status === 'approved'
          ? 'Your employer verification has been approved.'
          : status === 'rejected'
          ? `Your employer verification was rejected${note ? `: ${note}` : '.'}`
          : 'Your employer verification is pending review.';

      await Notification.create({
        recipient: v.employer,
        type,
        message,
        meta: { verificationId: String(v._id), decision: status, note },
      });
    } catch {}

    res.json({ message: 'Updated', status: v.status, note: v.note });
  } catch (e) {
    console.error('adminUpdateStatus error:', e);
    res.status(500).json({ message: 'Update failed.' });
  }
}
