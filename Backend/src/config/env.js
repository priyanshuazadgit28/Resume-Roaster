const dotenv = require('dotenv');
const path = require('path');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  MONGO_URI: z.string().url().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('arr_token'),

  CLIENT_ORIGIN: z.string().default('http://localhost:5173,http://localhost:5174'),

  GEMINI_API_KEY: z.string(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:');
  console.error(_env.error.format());
  process.exit(1);
}

// Transform the parsed data into camelCase to match what the rest of the app expects
module.exports = {
  isProd: _env.data.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5001,
  mongoUri: _env.data.MONGO_URI,
  jwtSecret: _env.data.JWT_SECRET,
  jwtExpiresIn: _env.data.JWT_EXPIRES_IN,
  cookieName: _env.data.COOKIE_NAME,
  clientOrigins: _env.data.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
  geminiApiKey: _env.data.GEMINI_API_KEY,
  geminiModel: _env.data.GEMINI_MODEL,
};
