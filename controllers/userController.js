// controllers/userController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

/* ------------------ helpers ------------------ */
function toSkillArray(input) {
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/* ------------------ auth ------------------ */
// @desc Register a new user
// @route POST /api/users/register
// @access Public
export const registerUser = async (req, res) => {
  try {
    const { name = '', email = '', password = '', role = 'jobseeker' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name?.trim() || 'New User',
      email: normalizedEmail,
      password: hashedPassword,
      role,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

// @desc Login user
// @route POST /api/users/login
// @access Public
export const loginUser = async (req, res) => {
  try {
    const { email = '', password = '' } = req.body;
    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

/* ------------------ profile ------------------ */

// @desc Get my profile (safe payload)
// @route GET /api/users/profile
// @access Private
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load profile', error: error.message });
  }
};

// @desc Update my profile (now persists all Edit Profile fields)
// @route PUT /api/users/profile
// @access Private
export const updateMyProfile = async (req, res) => {
  try {
    // Build a $set / $unset update doc so empty strings clear fields
    const $set = {};
    const $unset = {};

    const setStr = (key, val) => {
      if (typeof val === 'undefined') return;
      const v = String(val ?? '').trim();
      if (v) $set[key] = v;
      else $unset[key] = '';
    };

    // Core fields from your Edit Profile page
    setStr('name', req.body.name);
    setStr('headline', req.body.headline);
    setStr('phone', req.body.phone);
    setStr('region', req.body.region);
    setStr('city', req.body.city);
    setStr('bio', req.body.bio);

    // Keep original skills behavior (accept array or comma-separated string)
    if (typeof req.body.skills !== 'undefined') {
      $set.skills = toSkillArray(req.body.skills);
    }

    // Map "region" to your existing "location" field too (so Overview shows it)
    if (typeof req.body.region !== 'undefined') {
      const r = String(req.body.region || '').trim();
      if (r) $set.location = r;
      else $unset.location = '';
    }

    const updateDoc = {};
    if (Object.keys($set).length) updateDoc.$set = $set;
    if (Object.keys($unset).length) updateDoc.$unset = $unset;

    const user = await User.findByIdAndUpdate(req.user._id, updateDoc, {
      new: true,
      runValidators: true,
      select: '-password',
      // Allow saving keys that may not exist in the schema yet (e.g. headline/city)
      strict: false,
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      message: 'Profile updated',
      user,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

// @desc Change my password
// @route PUT /api/users/password
// @access Private
export const updateMyPassword = async (req, res) => {
  try {
    const { currentPassword = '', newPassword = '' } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update password', error: error.message });
  }
};

/* ------------------ employer verification (unchanged) ------------------ */

// Fire-and-forget notification helper
async function notify(recipient, type, message, meta = {}) {
  try {
    await Notification.create({ recipient, type, message, meta });
  } catch {
    // swallow notification errors
  }
}

// @desc Employer uploads verification documents
// @route POST /api/users/verify
// @access Private (Employer only)
export const uploadVerificationDocs = async (req, res) => {
  try {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ message: 'Only employers can upload verification documents' });
    }

    let filePaths = [];
    if (Array.isArray(req.files) && req.files.length) {
      filePaths = req.files.map((f) => f.path);
    } else if (req.file) {
      filePaths = [req.file.path];
    }
    if (!filePaths.length) return res.status(400).json({ message: 'No files uploaded' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.verificationDocuments = filePaths;
    user.verificationStatus = 'under review';
    user.isVerified = false;
    await user.save();

    res.status(200).json({
      message: 'Verification documents submitted',
      uploadedFiles: user.verificationDocuments,
      verificationStatus: user.verificationStatus,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading verification documents', error: error.message });
  }
};

// @desc Admin gets list of employers with uploaded docs
// @route GET /api/users/employers
// @access Private (Admin only)
export const getAllEmployersForReview = async (req, res) => {
  try {
    const employers = await User.find({
      role: 'employer',
      verificationDocuments: { $exists: true, $ne: [] },
    }).select('-password');

    res.status(200).json(employers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching employers', error: error.message });
  }
};

// @desc Admin updates employer verification status
// @route PUT /api/users/employers/:id/verify
// @access Private (Admin only)
export const updateEmployerVerificationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['under review', 'passed verification', 'failed verification'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid verification status' });
    }

    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'employer') {
      return res.status(404).json({ message: 'Employer not found' });
    }

    user.verificationStatus = status;
    user.isVerified = status === 'passed verification';
    await user.save();

    const message = {
      'under review': 'Your verification is under review.',
      'passed verification': 'Congratulations! Your employer verification was approved.',
      'failed verification': 'Your employer verification was rejected. Please try again.',
    };

    const notification = new Notification({
      recipient: user._id,
      type: status === 'passed verification' ? 'success' : 'warning',
      message: message[status],
    });

    await notification.save();

    res.status(200).json({
      message: 'Verification status updated and notification sent',
      employerId: user._id,
      newStatus: user.verificationStatus,
      isVerified: user.isVerified,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating verification status', error: error.message });
  }
};

// @desc Employer views own verification status
// @route GET /api/users/verify/status
// @access Private (Employer only)
export const getMyVerificationStatus = async (req, res) => {
  try {
    if (req.user.role !== 'employer') {
      return res.status(403).json({ message: 'Only employers can access this resource' });
    }

    const user = await User.findById(req.user._id).select(
      'verificationStatus verificationDocuments isVerified'
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      verificationStatus: user.verificationStatus,
      uploadedDocuments: user.verificationDocuments,
      isVerified: user.isVerified,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching verification status', error: error.message });
  }
};
