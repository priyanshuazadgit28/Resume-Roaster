const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: true,
    },
    explanation: { type: String, required: true },
    fix: { type: String, required: true },
  },
  { _id: false }
);

const strengthSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    evidence: { type: String, required: true },
  },
  { _id: false }
);

const bulletRewriteSchema = new mongoose.Schema(
  {
    section: { type: String, required: true },
    originalText: { type: String, required: true },
    rewrittenText: { type: String, required: true },
    rationale: { type: String, required: true },
  },
  // _id is true by default, keeping it on intentionally so frontend can target specific rewrites
);

const scoreBreakdownSchema = new mongoose.Schema(
  {
    keywords: { type: Number, min: 0, max: 25, required: true },
    formatting: { type: Number, min: 0, max: 25, required: true },
    impact: { type: Number, min: 0, max: 25, required: true },
    clarity: { type: Number, min: 0, max: 25, required: true },
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resume: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume',
      required: true,
    },
    version: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ResumeVersion',
      required: true,
    },
    atsScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    scoreBreakdown: {
      type: scoreBreakdownSchema,
      required: true,
    },
    issues: {
      type: [issueSchema],
      default: [],
    },
    strengths: {
      type: [strengthSchema],
      default: [],
    },
    bulletRewrites: {
      type: [bulletRewriteSchema],
      default: [],
    },
    keywordsPresent: {
      type: [String],
      default: [],
    },
    keywordsMissing: {
      type: [String],
      default: [],
    },
    summary: {
      type: String,
      required: true,
    },
    modelName: {
      type: String,
      required: true,
    },
    promptTokens: {
      type: Number,
      default: 0,
    },
    responseTokens: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Indexes
analysisSchema.index({ user: 1 });
analysisSchema.index({ resume: 1 });
analysisSchema.index({ version: 1 });

module.exports = mongoose.model('Analysis', analysisSchema);
