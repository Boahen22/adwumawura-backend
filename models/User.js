// models/User.js

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },

    // Roles
    role: {
      type: String,
      enum: ['jobseeker', 'employer', 'admin'],
      default: 'jobseeker',
      index: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },

    // Employer verification (kept from your logic)
    verificationStatus: {
      type: String,
      enum: ['under review', 'passed verification', 'failed verification'],
      default: 'under review',
    },
    verificationDocuments: {
      type: [String],
      default: [],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Profile fields (optional)
    headline: { type: String, trim: true, maxlength: 140 }, // NEW: short title
    phone: { type: String, trim: true },
    region: { type: String, trim: true },                   // NEW: region (kept separate from location)
    city: { type: String, trim: true },                     // NEW: city/town
    location: { type: String, trim: true },                 // e.g., legacy region/location
    bio: { type: String, trim: true, maxlength: 2000 },
    skills: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    education: { type: String, trim: true },
    experienceYears: { type: Number, min: 0, max: 80 },
    lookingFor: { type: String, trim: true },

    // Employer-only optional website; harmless if unused by jobseekers
    website: { type: String, trim: true },

    // Saved jobs for jobseekers
    savedJobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
      },
    ],
  },
  { timestamps: true }
);

// Normalize arrays to trimmed, unique strings
function normalizeStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const v of arr) {
    const s = String(v || '').trim();
    if (s) out.push(s);
  }
  return [...new Set(out)];
}

userSchema.pre('save', function (next) {
  if (this.isModified('skills')) this.skills = normalizeStringArray(this.skills);
  if (this.isModified('languages')) this.languages = normalizeStringArray(this.languages);
  next();
});

const User = mongoose.model('User', userSchema);
export default User;
