const env = require('../config/env');
const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/apiError');
const User = require('../models/user');
const asyncHandler = require('../utils/asyncHandler');

const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies[env.cookieName];

  if (!token) {
    throw ApiError.unauthorized('Authentication required');
  }

  try {
    const payload = verifyToken(token);
    
    // Look up the user by the sub claim (id)
    const user = await User.findById(payload.sub);
    
    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    // Attach user to request for downstream handlers
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Session expired. Please log in again.');
    } else if (error.name === 'JsonWebTokenError') {
      throw ApiError.unauthorized('Invalid session. Please log in again.');
    } else {
      throw error;
    }
  }
});

module.exports = { requireAuth };
