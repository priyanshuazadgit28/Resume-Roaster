const { GoogleGenAI, Type } = require('@google/genai');
const { z } = require('zod');
const env = require('../config/env');
const ApiError = require('../utils/apiError');

const client = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;

// Schema describing exactly what we want from Gemini
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    atsScore: { type: Type.INTEGER, description: 'Score from 0 to 100 based on ATS best practices' },
    scoreBreakdown: {
      type: Type.OBJECT,
      properties: {
        keywords: { type: Type.INTEGER, description: 'Score from 0 to 25' },
        formatting: { type: Type.INTEGER, description: 'Score from 0 to 25' },
        impact: { type: Type.INTEGER, description: 'Score from 0 to 25' },
        clarity: { type: Type.INTEGER, description: 'Score from 0 to 25' },
      },
      required: ['keywords', 'formatting', 'impact', 'clarity'],
    },
    issues: {
      type: Type.ARRAY,
      description: 'Exactly five prioritized issues',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
          explanation: { type: Type.STRING },
          fix: { type: Type.STRING },
        },
        required: ['title', 'severity', 'explanation', 'fix'],
      },
    },
    strengths: {
      type: Type.ARRAY,
      description: 'Exactly five strengths',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          evidence: { type: Type.STRING },
        },
        required: ['title', 'evidence'],
      },
    },
    bulletRewrites: {
      type: Type.ARRAY,
      description: '10 to 15 rewrites for weak bullet points',
      items: {
        type: Type.OBJECT,
        properties: {
          section: { type: Type.STRING },
          originalText: { type: Type.STRING },
          rewrittenText: { type: Type.STRING },
          rationale: { type: Type.STRING },
        },
        required: ['section', 'originalText', 'rewrittenText', 'rationale'],
      },
    },
    keywordsPresent: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywordsMissing: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: { type: Type.STRING, description: 'A short summary verdict' },
  },
  required: ['atsScore', 'scoreBreakdown', 'issues', 'strengths', 'bulletRewrites', 'keywordsPresent', 'keywordsMissing', 'summary'],
};

// Zod validator to ensure the data is perfectly shaped
const zodAnalysisSchema = z.object({
  atsScore: z.number().min(0).max(100),
  scoreBreakdown: z.object({
    keywords: z.number().min(0).max(25),
    formatting: z.number().min(0).max(25),
    impact: z.number().min(0).max(25),
    clarity: z.number().min(0).max(25),
  }),
  issues: z.array(
    z.object({
      title: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      explanation: z.string(),
      fix: z.string(),
    })
  ),
  strengths: z.array(
    z.object({
      title: z.string(),
      evidence: z.string(),
    })
  ),
  bulletRewrites: z.array(
    z.object({
      section: z.string(),
      originalText: z.string(),
      rewrittenText: z.string(),
      rationale: z.string(),
    })
  ),
  keywordsPresent: z.array(z.string()),
  keywordsMissing: z.array(z.string()),
  summary: z.string(),
});

const buildPrompt = (rawText, targetRole) => {
  return `You are a senior technical recruiter and ATS (Applicant Tracking System) expert. 
Your job is to thoroughly analyze the provided resume text and provide a structured JSON response evaluating its effectiveness${targetRole ? ` for the target role of: ${targetRole}` : ''}.

RULES:
1. Identify EXACTLY 5 prioritized issues that need fixing.
2. Identify EXACTLY 5 key strengths.
3. Provide 10 to 15 bullet point rewrites. Target weak bullets that lack quantifiable metrics or strong action verbs.
4. When rewriting bullets, you MUST preserve the original meaning and truthfulness.
5. Provide a realistic ATS score between 0 and 100.
6. The originalText field for rewrites MUST be an exact substring match from the resume.

--- RESUME TEXT ---
${rawText}
--- END RESUME TEXT ---
`;
};

const callGemini = async (prompt) => {
  const response = await client.models.generateContent({
    model: env.geminiModel,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
      temperature: 0.4,
    },
  });

  return {
    text: response.text,
    usage: response.usageMetadata,
  };
};

const analyzeResume = async (rawText, targetRole = '') => {
  if (!client) {
    throw new ApiError(500, 'Gemini API key is not configured');
  }

  const prompt = buildPrompt(rawText, targetRole);
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text, usage } = await callGemini(prompt);
      const parsedJSON = JSON.parse(text);
      const validatedData = zodAnalysisSchema.parse(parsedJSON);

      return {
        analysis: validatedData,
        modelName: env.geminiModel,
        promptTokens: usage?.promptTokenCount || 0,
        responseTokens: usage?.candidatesTokenCount || 0,
      };
    } catch (error) {
      lastError = error;
      console.error(`Analysis attempt ${attempt} failed:`, error.message);
    }
  }

  throw new ApiError(500, `AI Analysis failed after 2 attempts: ${lastError.message}`);
};

module.exports = { analyzeResume };
