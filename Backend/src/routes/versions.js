const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const Resume = require('../models/resume');
const ResumeVersion = require('../models/resumeVersion');
const Analysis = require('../models/analysis');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const resumes = await Resume.find({ user: req.user.id }).select('title');
    const resumeIds = resumes.map((r) => r._id);

    const versions = await ResumeVersion.find({ resume: { $in: resumeIds } })
      .sort({ createdAt: -1 })
      .select('resume versionNumber label sourceType createdAt');

    const versionIds = versions.map((v) => v._id);
    const analyses = await Analysis.find({ version: { $in: versionIds } }).select('version atsScore');

    const scoreMap = {};
    analyses.forEach((a) => {
      scoreMap[a.version.toString()] = a.atsScore;
    });

    const resumeMap = {};
    resumes.forEach((r) => {
      resumeMap[r._id.toString()] = r.title;
    });

    let uploadsCount = 0;
    let rewritesCount = 0;

    const rows = versions.map((v) => {
      if (v.sourceType === 'upload') uploadsCount++;
      else rewritesCount++;

      return {
        id: v._id,
        resumeId: v.resume,
        title: resumeMap[v.resume.toString()] || 'Unknown',
        label: v.label,
        sourceType: v.sourceType,
        score: scoreMap[v._id.toString()] || null,
        createdAt: v.createdAt,
      };
    });

    res.json({
      rows,
      totals: {
        all: rows.length,
        uploads: uploadsCount,
        rewrites: rewritesCount,
      },
    });
  })
);

module.exports = router;
