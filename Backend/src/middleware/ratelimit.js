const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const ApiError = require('../utils/apiError');

// Helper to get client IP or User ID for rate limiting key
const keyGenerator = (req, res) => {
  return req.user ? req.user.id : ipKeyGenerator(req, res);
};

// Error handler for rate limit exceeded
const handler = (req, res, next, options) => {
  next(ApiError.tooMany(options.message));
};

const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each user/IP to 5 requests per windowMs
  keyGenerator,
  handler,
  validate: { trustProxy: false, default: true, ip: false },
  message: 'Too many analysis requests. Please try again in a minute.',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  // Omit custom keyGenerator to let it use default IP generator safely
  handler,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

module.exports = {
  analyzeLimiter,
  authLimiter,
};
