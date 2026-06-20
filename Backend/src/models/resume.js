const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    currentVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ResumeVersion',
    },
    latestVersionNumber: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes
resumeSchema.index({ user: 1 });
resumeSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('Resume', resumeSchema);
