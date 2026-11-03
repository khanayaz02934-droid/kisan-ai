import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import generateToken from '../utils/generateToken.js';
import apiResponse from '../utils/apiResponse.js';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, state, district, village, preferredLang } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error('Name, email, and password are required');
  }

  if (!emailPattern.test(String(email).trim())) {
    res.status(400);
    throw new Error('Please enter a valid email address');
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  // Explicit pre-check for a human-readable 400 before relying on the
  // `unique` index (errorMiddleware maps a 11000 race to 400 as a fallback).
  const userExists = await User.findOne({ email: String(email).trim().toLowerCase() });
  if (userExists) {
    res.status(400);
    throw new Error('User with this email already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    phone: phone || '',
    state: state || '',
    district: district || '',
    village: village || '',
    preferredLang: preferredLang || 'en',
  });

  const token = generateToken(user._id);

  apiResponse(res, 201, true, 'Registration successful', {
    user,
    token,
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required');
  }

  const user = await User.findOne({ email });

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    res.status(401);
    throw new Error('Your account has been deactivated. Contact support.');
  }

  const token = generateToken(user._id);

  apiResponse(res, 200, true, 'Login successful', { user, token });
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  apiResponse(res, 200, true, 'Profile fetched', req.user);
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, state, district, village, preferredLang, currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (state !== undefined) user.state = state;
  if (district !== undefined) user.district = district;
  if (village !== undefined) user.village = village;
  if (preferredLang && ['en', 'hi'].includes(preferredLang)) user.preferredLang = preferredLang;

  // Password change
  if (newPassword) {
    if (!currentPassword) {
      res.status(400);
      throw new Error('Current password is required to change password');
    }
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      res.status(401);
      throw new Error('Current password is incorrect');
    }
    if (newPassword.length < 6) {
      res.status(400);
      throw new Error('New password must be at least 6 characters');
    }
    user.password = newPassword;
  }

  const updatedUser = await user.save();
  apiResponse(res, 200, true, 'Profile updated successfully', updatedUser);
});

export { register, login, getMe, updateProfile };
