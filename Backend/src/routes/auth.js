const express = require('express');
const { z } = require('zod');
const env = require('../config/env');
const { signToken, cookieOptions } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/ratelimit');
const ApiError = require('../utils/apiError');
const User = require('../models/user');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Zod schemas
const registerSchema = z.object({
  email: z.string().email('Please provide a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1, 'Name is required').max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

// Helper to issue session cookie
const issueSession = (res, userId) => {
  const token = signToken({ sub: userId });
  res.cookie(env.cookieName, token, cookieOptions);
};

// Routes

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw ApiError.conflict('Email already exists');
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ email, passwordHash, name });

    issueSession(res, user._id);
    res.status(201).json(user);
  })
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    issueSession(res, user._id);
    res.json(user);
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    res.clearCookie(env.cookieName, cookieOptions);
    res.json({ message: 'Logged out successfully' });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  })
);

router.patch(
  '/profile',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body;
    
    req.user.name = name;
    await req.user.save();
    
    res.json(req.user);
  })
);

router.patch(
  '/password',
  requireAuth,
  validate(updatePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Refetch user to get passwordHash
    const user = await User.findById(req.user._id).select('+passwordHash');
    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw ApiError.unauthorized('Incorrect current password');
    }

    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  })
);

module.exports = router;
