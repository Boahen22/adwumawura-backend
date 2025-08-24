// models/EmployerVerification.js
// Schema for employer verification submissions and review state.

import mongoose from "mongoose";

const employerVerificationSchema = new mongoose.Schema(
  {
    // Employer user who submitted the verification
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      unique: true, // one active verification record per employer
    },

    // Review status; "unverified" is represented by absence of a record
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    // Optional admin note/reason (e.g., why rejected)
    note: {
      type: String,
      default: "",
      trim: true,
    },

    // Stored file info (set by your upload handler)
    filePath: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },

    // When the employer submitted the document
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Keep createdAt/updatedAt for admin lists and sorting
    timestamps: true,
  }
);

// Ensure submittedAt is set if missing
employerVerificationSchema.pre("save", function (next) {
  if (!this.submittedAt) this.submittedAt = new Date();
  next();
});

const EmployerVerification = mongoose.model(
  "EmployerVerification",
  employerVerificationSchema
);

export default EmployerVerification;
