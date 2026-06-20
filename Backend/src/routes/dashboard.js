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
    // 1. Fetch all user resumes
    const resumes = await Resume.find({ user: req.user.id })
      .sort({ updatedAt: -1 })
      .populate('currentVersionId', '-rawText');

    const resumeIds = resumes.map((r) => r._id);

    // 2. Count totals
    const [rewriteCount, analysisCount] = await Promise.all([
      ResumeVersion.countDocuments({ resume: { $in: resumeIds }, sourceType: 'rewrite' }),
      Analysis.countDocuments({ user: req.user.id }),
    ]);

    // 3. Compute Latest Resume & Charts
    const latestResume = resumes[0] || null;
    let scoreSeries = [];
    let versionStack = [];

    if (latestResume) {
      const versions = await ResumeVersion.find({ resume: latestResume._id })
        .sort({ versionNumber: 1 })
        .select('_id versionNumber label sourceType latestAnalysisId createdAt');

      const versionIds = versions.map((v) => v._id);
      const analyses = await Analysis.find({ version: { $in: versionIds } })
        .sort({ createdAt: 1 })
        .select('version atsScore createdAt');

      const scoreMap = {};
      analyses.forEach((a) => {
        scoreMap[a.version.toString()] = a.atsScore;
      });

      versions.forEach((v) => {
        const score = scoreMap[v._id.toString()];
        if (score !== undefined) {
          scoreSeries.push({
            label: v.label,
            score,
            date: v.createdAt,
          });
        }
      });

      // Version stack (last 3)
      const lastThree = versions.slice(-3).reverse();
      versionStack = lastThree.map((v, i) => {
        const score = scoreMap[v._id.toString()] || null;
        let delta = 0;
        if (i < lastThree.length - 1 && score !== null) {
          const prevScore = scoreMap[lastThree[i + 1]._id.toString()];
          if (prevScore !== undefined) delta = score - prevScore;
        }
        return {
          label: v.label,
          type: v.sourceType,
          score,
          delta,
        };
      });
    }

    // 4. Compute KPIs
    const allAnalyses = await Analysis.find({ user: req.user.id })
      .sort({ createdAt: 1 })
      .select('atsScore issues keywordsPresent keywordsMissing createdAt');

    // Extract trends for sparklines (last 10)
    const recent10 = allAnalyses.slice(-10);
    const scoreTrend = recent10.map((a) => a.atsScore);
    const issuesTrend = recent10.map((a) => a.issues.length);
    const keywordsTrend = recent10.map((a) => a.keywordsPresent.length);

    const latestAnalysis = allAnalyses[allAnalyses.length - 1] || null;
    const prevAnalysis = allAnalyses[allAnalyses.length - 2] || null;

    const totalVersions = await ResumeVersion.countDocuments({ resume: { $in: resumeIds } });

    const kpi = {
      atsScore: {
        value: latestAnalysis ? latestAnalysis.atsScore : null,
        delta: latestAnalysis && prevAnalysis ? latestAnalysis.atsScore - prevAnalysis.atsScore : 0,
        spark: scoreTrend,
      },
      versions: {
        value: totalVersions,
        delta: rewriteCount, // total rewrites as a proxy for positive change
        spark: [],
      },
      issuesIdentified: {
        value: latestAnalysis ? latestAnalysis.issues.length : null,
        delta: latestAnalysis && prevAnalysis ? latestAnalysis.issues.length - prevAnalysis.issues.length : 0,
        spark: issuesTrend,
      },
      keywordsMatched: {
        value: latestAnalysis ? latestAnalysis.keywordsPresent.length : null,
        total: latestAnalysis ? latestAnalysis.keywordsPresent.length + latestAnalysis.keywordsMissing.length : 0,
        delta: latestAnalysis && prevAnalysis ? latestAnalysis.keywordsPresent.length - prevAnalysis.keywordsPresent.length : 0,
        spark: keywordsTrend,
      },
    };

    // 5. Activity Feed
    const recentVersions = await ResumeVersion.find({ resume: { $in: resumeIds } })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('resume', 'title');

    const recentAnalyses = await Analysis.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('resume', 'title');

    let feed = [];

    recentVersions.forEach((v) => {
      feed.push({
        id: v._id,
        type: v.sourceType === 'upload' ? 'upload' : 'rewrite',
        title: v.resume?.title || 'Unknown',
        subtitle: v.sourceType === 'upload' ? 'Uploaded new resume' : 'Applied AI rewrites',
        label: v.label,
        at: v.createdAt,
      });
    });

    recentAnalyses.forEach((a) => {
      feed.push({
        id: a._id,
        type: 'analyze',
        title: a.resume?.title || 'Unknown',
        subtitle: `Scored ${a.atsScore}`,
        label: 'AI',
        at: a.createdAt,
      });
    });

    // Sort combined newest first, take 8
    feed.sort((a, b) => b.at - a.at);
    feed = feed.slice(0, 8);

    res.json({
      totals: {
        resumes: resumes.length,
        analyses: analysisCount,
        rewrites: rewriteCount,
      },
      latestResume,
      scoreSeries,
      versionStack,
      kpi,
      activity: feed,
    });
  })
);

module.exports = router;
