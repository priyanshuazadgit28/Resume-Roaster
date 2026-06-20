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
    const resumes = await Resume.find({ user: req.user.id }).select('title createdAt');
    const resumeIds = resumes.map((r) => r._id);

    const [versions, analyses] = await Promise.all([
      ResumeVersion.find({ resume: { $in: resumeIds } }).select('resume label sourceType createdAt').populate('resume', 'title'),
      Analysis.find({ user: req.user.id }).select('resume atsScore createdAt').populate('resume', 'title'),
    ]);

    const events = [];
    const totals = {
      all: 0,
      upload: 0,
      rewrite: 0,
      analyze: 0,
    };

    // Uploads are essentially when a resume is created, or when an upload version is created
    // We'll track versions instead of resumes directly, as versions map 1:1 to uploads/rewrites
    versions.forEach((v) => {
      const type = v.sourceType === 'upload' ? 'upload' : 'rewrite';
      events.push({
        id: v._id,
        type,
        title: v.resume?.title || 'Unknown',
        subtitle: type === 'upload' ? 'Uploaded new resume' : 'Applied AI rewrites',
        label: v.label,
        at: v.createdAt,
        resumeId: v.resume._id || v.resume,
      });

      totals.all++;
      if (type === 'upload') totals.upload++;
      else totals.rewrite++;
    });

    analyses.forEach((a) => {
      events.push({
        id: a._id,
        type: 'analyze',
        title: a.resume?.title || 'Unknown',
        subtitle: `Scored ${a.atsScore}`,
        label: 'AI',
        at: a.createdAt,
        resumeId: a.resume._id || a.resume,
      });

      totals.all++;
      totals.analyze++;
    });

    events.sort((a, b) => b.at - a.at);



    res.json({
      events,
      totals,
    });
  })
);

module.exports = router;
