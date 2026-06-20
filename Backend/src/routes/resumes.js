const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { requireAuth } = require('../middleware/auth');
const { analyzeLimiter } = require('../middleware/ratelimit');
const { uploadPDF } = require('../middleware/upload');
const validate = require('../middleware/validate');

const Resume = require('../models/resume');
const ResumeVersion = require('../models/resumeVersion');
const Analysis = require('../models/analysis');

const { extractText } = require('../services/pdfService');
const { parseResume } = require('../services/structuredParser');
const { analyzeResume } = require('../services/gemini');
const { diffText, summarizeDiff } = require('../services/diffService');

const router = express.Router();

// All routes here require authentication
router.use(requireAuth);

// Validation Schemas
const idSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ID format',
});

const idParamSchema = z.object({
  id: idSchema,
});

const versionParamsSchema = z.object({
  id: idSchema,
  versionId: idSchema,
});

const analyzeBodySchema = z.object({
  versionId: idSchema.optional(),
  targetRole: z.string().optional(),
});

const rewriteBodySchema = z.object({
  analysisId: idSchema,
  rewriteIds: z.array(idSchema).optional(),
  label: z.string().optional(),
});

const diffQuerySchema = z.object({
  from: idSchema,
  to: idSchema,
  mode: z.enum(['word', 'line']).optional(),
});

// Helper: Load owned resume
const loadOwnedResume = async (req, id) => {
  const resume = await Resume.findOne({ _id: id, user: req.user.id });
  if (!resume) throw new ApiError(404, 'Resume not found');
  return resume;
};

// Helper: Load owned version
const loadOwnedVersion = async (req, resumeId, versionId) => {
  const version = await ResumeVersion.findOne({
    _id: versionId,
    resume: resumeId,
  });
  // We already verified the resume belongs to the user, so if the version belongs to the resume, it's safe.
  if (!version) throw new ApiError(404, 'Resume version not found');
  return version;
};

// ==========================================
// 1. Upload & Parse
// ==========================================
router.post(
  '/',
  uploadPDF,
  asyncHandler(async (req, res) => {
    // 1. Extract Text
    const { text, meta } = await extractText(req.file.buffer);

    // 2. Parse Structured JSON using Gemini
    const parsedSections = await parseResume(text);

    // 3. Determine Title
    let title = req.body.title || req.file.originalname.replace(/\.pdf$/i, '') || 'Untitled Resume';

    // 4. Create Resume Document
    const resume = await Resume.create({
      user: req.user.id,
      title,
      latestVersionNumber: 1,
    });

    // 5. Create V1 Version Document
    const version = await ResumeVersion.create({
      resume: resume._id,
      versionNumber: 1,
      label: 'V1',
      rawText: text,
      parsedSections,
      sourceType: 'upload',
    });

    // 6. Link version to resume
    resume.currentVersionId = version._id;
    await resume.save();

    res.status(201).json({
      resume,
      version,
      meta,
    });
  })
);

// ==========================================
// 2. List Resumes
// ==========================================
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const resumes = await Resume.find({ user: req.user.id })
      .sort({ updatedAt: -1 })
      .populate('currentVersionId', '-rawText'); // exclude heavy rawText

    res.json(resumes);
  })
);

// ==========================================
// 3. Get Resume Details (Include all versions)
// ==========================================
router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req, req.params.id);
    const versions = await ResumeVersion.find({ resume: resume._id })
      .sort({ versionNumber: -1 })
      .select('-rawText'); // exclude heavy rawText

    res.json({
      resume,
      versions,
    });
  })
);

// ==========================================
// 4. Get Specific Version
// ==========================================
router.get(
  '/:id/versions/:versionId',
  validate(versionParamsSchema, 'params'),
  asyncHandler(async (req, res) => {
    await loadOwnedResume(req, req.params.id);
    const version = await loadOwnedVersion(req, req.params.id, req.params.versionId);
    res.json(version);
  })
);

// ==========================================
// 5. Delete Resume
// ==========================================
router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req, req.params.id);

    // Clean up versions and analyses
    await ResumeVersion.deleteMany({ resume: resume._id });
    await Analysis.deleteMany({ resume: resume._id });
    await resume.deleteOne();

    res.json({ message: 'Resume deleted successfully' });
  })
);

// ==========================================
// 6. Analyze Resume
// ==========================================
router.post(
  '/:id/analyze',
  analyzeLimiter,
  validate(idParamSchema, 'params'),
  validate(analyzeBodySchema, 'body'),
  asyncHandler(async (req, res) => {
    const { versionId, targetRole } = req.body;
    const resume = await loadOwnedResume(req, req.params.id);
    
    const targetVersionId = versionId || resume.currentVersionId;
    if (!targetVersionId) throw new ApiError(400, 'No version available to analyze');

    const version = await loadOwnedVersion(req, resume._id, targetVersionId);

    // Call Gemini
    const { analysis, modelName, promptTokens, responseTokens } = await analyzeResume(
      version.rawText,
      targetRole
    );

    // Save Analysis
    const analysisDoc = await Analysis.create({
      user: req.user.id,
      resume: resume._id,
      version: version._id,
      atsScore: analysis.atsScore,
      scoreBreakdown: analysis.scoreBreakdown,
      issues: analysis.issues,
      strengths: analysis.strengths,
      bulletRewrites: analysis.bulletRewrites,
      keywordsPresent: analysis.keywordsPresent,
      keywordsMissing: analysis.keywordsMissing,
      summary: analysis.summary,
      modelName,
      promptTokens,
      responseTokens,
    });

    // Update version pointer
    version.latestAnalysisId = analysisDoc._id;
    await version.save();

    res.json(analysisDoc);
  })
);

// ==========================================
// 7. List Analyses
// ==========================================
router.get(
  '/:id/analyses',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await loadOwnedResume(req, req.params.id);
    const analyses = await Analysis.find({ resume: req.params.id }).sort({ createdAt: -1 });
    res.json(analyses);
  })
);

// ==========================================
// 8. Latest Analysis For Version
// ==========================================
router.get(
  '/:id/versions/:versionId/analysis',
  validate(versionParamsSchema, 'params'),
  asyncHandler(async (req, res) => {
    await loadOwnedResume(req, req.params.id);
    await loadOwnedVersion(req, req.params.id, req.params.versionId);

    const analysis = await Analysis.findOne({ version: req.params.versionId }).sort({ createdAt: -1 });
    res.json(analysis); // can be null
  })
);

// ==========================================
// Helpers for Rewrite Route
// ==========================================
const applyRewritesToText = (rawText, rewritesToApply) => {
  let updatedText = rawText;
  rewritesToApply.forEach((rw) => {
    if (updatedText.includes(rw.originalText)) {
      updatedText = updatedText.replace(rw.originalText, rw.rewrittenText);
    } else {
      // Fallback: append it if original text formatting changed
      updatedText += `\n${rw.rewrittenText}`;
    }
  });
  return updatedText;
};

const patchBulletsInSections = (parsedSections, rewritesToApply) => {
  const sectionsCopy = JSON.parse(JSON.stringify(parsedSections));
  if (sectionsCopy.experience) {
    sectionsCopy.experience.forEach((job) => {
      if (job.bullets) {
        job.bullets = job.bullets.map((bullet) => {
          const match = rewritesToApply.find((rw) => rw.originalText === bullet);
          return match ? match.rewrittenText : bullet;
        });
      }
    });
  }
  return sectionsCopy;
};

const looksEmpty = (parsedSections) => {
  if (!parsedSections) return true;
  const noName = !parsedSections.basics?.name;
  const noExperience = !parsedSections.experience || parsedSections.experience.length === 0;
  return noName && noExperience;
};

// ==========================================
// 9. Rewrite Version
// ==========================================
router.post(
  '/:id/rewrite',
  validate(idParamSchema, 'params'),
  validate(rewriteBodySchema, 'body'),
  asyncHandler(async (req, res) => {
    const { analysisId, rewriteIds, label } = req.body;
    const resume = await loadOwnedResume(req, req.params.id);

    const analysis = await Analysis.findOne({ _id: analysisId, resume: resume._id });
    if (!analysis) throw new ApiError(404, 'Analysis not found');

    const baseVersion = await loadOwnedVersion(req, resume._id, analysis.version);

    // Determine rewrites to apply
    let rewritesToApply = [];
    if (!rewriteIds || rewriteIds.length === 0) {
      rewritesToApply = analysis.bulletRewrites;
    } else {
      rewritesToApply = analysis.bulletRewrites.filter((rw) => rewriteIds.includes(rw._id.toString()));
    }

    if (rewritesToApply.length === 0) {
      throw new ApiError(400, 'No valid rewrites selected');
    }

    // 1. Apply rewrites to raw text
    const newRawText = applyRewritesToText(baseVersion.rawText, rewritesToApply);

    // 2. Pre-build a patched structured copy as a safety net
    const patchedSections = patchBulletsInSections(baseVersion.parsedSections, rewritesToApply);

    // 3. Re-parse the new text with Gemini
    let freshParsedSections = await parseResume(newRawText);

    // 4. Fallback if Gemini failed or hallucinated an empty doc
    if (looksEmpty(freshParsedSections)) {
      freshParsedSections = patchedSections;
    }

    // 5. Create new Version
    const newVersionNumber = resume.latestVersionNumber + 1;
    const newVersionLabel = label || `V${newVersionNumber}`;

    const newVersion = await ResumeVersion.create({
      resume: resume._id,
      versionNumber: newVersionNumber,
      label: newVersionLabel,
      rawText: newRawText,
      parsedSections: freshParsedSections,
      sourceType: 'rewrite',
      parentVersionId: baseVersion._id,
    });

    // 6. Update Resume
    resume.latestVersionNumber = newVersionNumber;
    resume.currentVersionId = newVersion._id;
    await resume.save();

    res.status(201).json({
      version: newVersion,
      appliedCount: rewritesToApply.length,
    });
  })
);

// ==========================================
// 10. Diff Versions
// ==========================================
router.get(
  '/:id/diff',
  validate(idParamSchema, 'params'),
  validate(diffQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { from, to, mode = 'word' } = req.query;
    await loadOwnedResume(req, req.params.id);

    const [fromVersion, toVersion] = await Promise.all([
      loadOwnedVersion(req, req.params.id, from),
      loadOwnedVersion(req, req.params.id, to),
    ]);

    const diffParts = diffText(fromVersion.rawText, toVersion.rawText, mode);
    const summary = summarizeDiff(diffParts);

    res.json({
      fromVersion: { id: fromVersion._id, label: fromVersion.label },
      toVersion: { id: toVersion._id, label: toVersion.label },
      parts: diffParts,
      summary,
    });
  })
);

module.exports = router;
