const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signToken = (payload) => {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, env.jwtSecret);
};

// Parse 7d into milliseconds (7 * 24 * 60 * 60 * 1000)
// For simplicity, we just set a fixed 7 days in ms since the video uses 7 days.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.isProd ? 'none' : 'lax',
  maxAge: MAX_AGE_MS,
};

module.exports = {
  signToken,
  verifyToken,
  cookieOptions,
};
