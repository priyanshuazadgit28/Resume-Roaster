const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const Resume = require('../models/resume');
const Analysis = require('../models/analysis');

const router = express.Router();

router.use(requireAuth);

const getTopItems = (items, keyFn, limit) => {
  const counts = {};
  const samples = {};

  items.forEach((item) => {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
    if (!samples[key]) {
      samples[key] = item;
    }
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      count,
      sample: samples[key],
    }));
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const resumes = await Resume.find({ user: req.user.id });
    const analyses = await Analysis.find({ user: req.user.id })
      .sort({ createdAt: 1 })
      .populate('resume', 'title');

    if (analyses.length === 0) {
      return res.json({ empty: true });
    }

    // Averages and Bests
    let totalScore = 0;
    let bestScoreVal = -1;
    let bestAnalysis = null;

    const scoreTrend = [];
    const allIssues = [];
    const allMissingKeywords = [];
    const allPresentKeywords = [];

    analyses.forEach((a) => {
      totalScore += a.atsScore;

      if (a.atsScore > bestScoreVal) {
        bestScoreVal = a.atsScore;
        bestAnalysis = a;
      }

      scoreTrend.push({
        score: a.atsScore,
        at: a.createdAt,
        resumeTitle: a.resume?.title || 'Unknown',
      });

      a.issues.forEach((i) => allIssues.push(i));
      a.keywordsMissing.forEach((k) => allMissingKeywords.push(k));
      a.keywordsPresent.forEach((k) => allPresentKeywords.push(k));
    });

    const averageScore = Math.round(totalScore / analyses.length);

    // Top Items
    const topIssues = getTopItems(allIssues, (i) => i.title, 6).map(item => ({
      title: item.sample.title,
      severity: item.sample.severity,
      count: item.count,
    }));

    const topMissingKeywords = getTopItems(allMissingKeywords, (k) => k.toLowerCase(), 12).map(item => ({
      keyword: item.sample,
      count: item.count,
    }));

    const topPresentKeywords = getTopItems(allPresentKeywords, (k) => k.toLowerCase(), 12).map(item => ({
      keyword: item.sample,
      count: item.count,
    }));

    // Per-Resume Table
    const resumePerformance = [];

    resumes.forEach((r) => {
      const resumeAnalyses = analyses.filter((a) => a.resume && a.resume._id.toString() === r._id.toString());
      if (resumeAnalyses.length > 0) {
        const latest = resumeAnalyses[resumeAnalyses.length - 1];
        const best = Math.max(...resumeAnalyses.map((a) => a.atsScore));
        const first = resumeAnalyses[0];
        const improvement = latest.atsScore - first.atsScore;

        resumePerformance.push({
          resumeId: r._id,
          title: r.title,
          latestScore: latest.atsScore,
          bestScore: best,
          improvement,
          analysesCount: resumeAnalyses.length,
        });
      }
    });

    res.json({
      empty: false,
      averageScore,
      bestScore: {
        value: bestScoreVal,
        resumeTitle: bestAnalysis?.resume?.title || 'Unknown',
      },
      totalAnalyses: analyses.length,
      scoreTrend,
      topIssues,
      topMissingKeywords,
      topPresentKeywords,
      resumePerformance,
    });
  })
);

module.exports = router;
