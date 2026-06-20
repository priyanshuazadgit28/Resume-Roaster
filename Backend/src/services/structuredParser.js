const { GoogleGenAI, Type } = require('@google/genai');
const { z } = require('zod');
const env = require('../config/env');

const client = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;

// The schema we tell Gemini to produce
const linkSchema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING },
    url: { type: Type.STRING },
  },
  required: ['label', 'url'],
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    basics: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        title: { type: Type.STRING },
        location: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        links: { type: Type.ARRAY, items: linkSchema },
      },
      required: ['name', 'title', 'location', 'email', 'phone', 'links'],
    },
    summary: { type: Type.STRING },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING },
          role: { type: Type.STRING },
          location: { type: Type.STRING },
          period: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['company', 'role', 'location', 'period', 'bullets'],
      },
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          degree: { type: Type.STRING },
          school: { type: Type.STRING },
          location: { type: Type.STRING },
          period: { type: Type.STRING },
          details: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['degree', 'school', 'location', 'period', 'details'],
      },
    },
    skills: { type: Type.ARRAY, items: { type: Type.STRING } },
    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          techTags: { type: Type.ARRAY, items: { type: Type.STRING } },
          links: { type: Type.ARRAY, items: linkSchema },
        },
        required: ['name', 'description', 'techTags', 'links'],
      },
    },
    certifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          issuer: { type: Type.STRING },
          year: { type: Type.STRING },
        },
        required: ['name', 'issuer', 'year'],
      },
    },
    languages: { type: Type.ARRAY, items: { type: Type.STRING } },
    interests: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['basics', 'summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'interests'],
};

// Zod validator to ensure the data matches our schema with fallbacks
const zodLinkSchema = z.object({
  label: z.string().catch(''),
  url: z.string().catch(''),
});

const parsedSectionsZodSchema = z.object({
  basics: z.object({
    name: z.string().catch(''),
    title: z.string().catch(''),
    location: z.string().catch(''),
    email: z.string().catch(''),
    phone: z.string().catch(''),
    links: z.array(zodLinkSchema).catch([]),
  }).catch({ name: '', title: '', location: '', email: '', phone: '', links: [] }),
  summary: z.string().catch(''),
  experience: z.array(
    z.object({
      company: z.string().catch(''),
      role: z.string().catch(''),
      location: z.string().catch(''),
      period: z.string().catch(''),
      bullets: z.array(z.string()).catch([]),
    })
  ).catch([]),
  education: z.array(
    z.object({
      degree: z.string().catch(''),
      school: z.string().catch(''),
      location: z.string().catch(''),
      period: z.string().catch(''),
      details: z.array(z.string()).catch([]),
    })
  ).catch([]),
  skills: z.array(z.string()).catch([]),
  projects: z.array(
    z.object({
      name: z.string().catch(''),
      description: z.string().catch(''),
      techTags: z.array(z.string()).catch([]),
      links: z.array(zodLinkSchema).catch([]),
    })
  ).catch([]),
  certifications: z.array(
    z.object({
      name: z.string().catch(''),
      issuer: z.string().catch(''),
      year: z.string().catch(''),
    })
  ).catch([]),
  languages: z.array(z.string()).catch([]),
  interests: z.array(z.string()).catch([]),
});

const emptyFallback = {
  basics: { name: '', title: '', location: '', email: '', phone: '', links: [] },
  summary: '',
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
  interests: [],
};

const buildPrompt = (rawText) => {
  return `You are an expert resume parser. Your job is to extract information from the following resume text and format it into the exact JSON structure requested.

RULES:
1. Be conservative. Do not hallucinate or invent information. If a field is missing, return an empty string or empty array.
2. Do not paraphrase. Extract the exact text from the resume where possible.
3. Preserve original date formats.
4. Extract every bullet point exactly as it appears.

--- RESUME TEXT ---
${rawText}
--- END RESUME TEXT ---
`;
};

const parseResume = async (rawText) => {
  if (!client || !rawText) return emptyFallback;

  const prompt = buildPrompt(rawText);
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: env.geminiModel,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
          temperature: 0.2, // low temperature for consistent parsing
        },
      });

      const parsedJSON = JSON.parse(response.text);
      return parsedSectionsZodSchema.parse(parsedJSON);
    } catch (error) {
      lastError = error;
      console.error(`Structured parser attempt ${attempt} failed:`, error.message);
    }
  }

  console.error('Structured parser completely failed after 2 attempts. Returning empty fallback.', lastError);
  return emptyFallback;
};

module.exports = { parseResume };
