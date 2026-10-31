import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import CropScan from '../models/cropScanModel.js';
import GrainOrder from '../models/grainOrderModel.js';
import Product from '../models/productModel.js';
import Grain from '../models/grainModel.js';
import apiResponse from '../utils/apiResponse.js';
import { escapeRegExp } from '../utils/escapeRegExp.js';
import cloudinary, { cloudinaryConfigured } from '../config/cloudinary.js';

// @desc    Get admin dashboard stats
// @route   GET /api/admin/stats
// @access  Admin
const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalScans,
    totalOrders,
    totalGrainOrders,
    totalProducts,
    totalGrains,
    pendingOrders,
    recentOrders,
  ] = await Promise.all([
    User.countDocuments({ userType: 'USER' }),
    CropScan.countDocuments(),
    Order.countDocuments(),
    GrainOrder.countDocuments(),
    Product.countDocuments({ isActive: true }),
    Grain.countDocuments({ isActive: true }),
    Order.countDocuments({ status: 'PLACED' }),
    Order.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name email').lean(),
  ]);

  // Revenue calculation
  const revenueResult = await Order.aggregate([
    { $match: { status: { $in: ['DELIVERED', 'CONFIRMED', 'SHIPPED'] } } },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } },
  ]);
  const revenue = revenueResult[0]?.total || 0;

  const grainRevenueResult = await GrainOrder.aggregate([
    { $match: { status: { $in: ['DELIVERED', 'CONFIRMED', 'DISPATCHED'] } } },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } },
  ]);
  const grainRevenue = grainRevenueResult[0]?.total || 0;

  apiResponse(res, 200, true, 'Dashboard stats fetched', {
    totalUsers,
    totalScans,
    totalOrders,
    totalGrainOrders,
    totalProducts,
    totalGrains,
    pendingOrders,
    revenue,
    grainRevenue,
    totalRevenue: revenue + grainRevenue,
    recentOrders,
  });
});

// @desc    Get all users (Admin)
// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role, includeDeleted } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  // Deleted (soft-deleted) accounts are hidden unless explicitly requested.
  if (includeDeleted !== 'true') query.deletedAt = null;

  if (role && ['USER', 'ADMIN'].includes(role.toUpperCase())) {
    query.userType = role.toUpperCase();
  }

  if (search) {
    const searchPattern = new RegExp(escapeRegExp(search), 'i');
    query.$or = [
      { name: searchPattern },
      { email: searchPattern },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    User.countDocuments(query),
  ]);

  apiResponse(res, 200, true, 'Users fetched', {
    users,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Get single user with order stats (Admin)
// @route   GET /api/admin/users/:id
// @access  Admin
const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400);
    throw new Error('Invalid user id');
  }

  const user = await User.findById(id).select('-password').lean();
  if (!user || user.deletedAt) {
    res.status(404);
    throw new Error('User not found');
  }

  // Referential safety overview: the user's historical records stay intact.
  const [orderCount, orderTotal, recentOrders, scanCount] = await Promise.all([
    Order.countDocuments({ user: id }),
    Order.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(id), status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
    Order.find({ user: id }).sort({ createdAt: -1 }).limit(5).lean(),
    CropScan.countDocuments({ user: id }),
  ]);

  apiResponse(res, 200, true, 'User fetched', {
    user,
    orderStats: { count: orderCount, totalSpent: orderTotal[0]?.total || 0 },
    scanCount,
    recentOrders,
  });
});

// @desc    Delete a user (Admin) — soft delete, history preserved
// @route   DELETE /api/admin/users/:id
// @access  Admin
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400);
    throw new Error('Invalid user id');
  }

  if (id === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot delete your own account');
  }

  const user = await User.findById(id);
  if (!user || user.deletedAt) {
    res.status(404);
    throw new Error('User not found');
  }

  // Protect the last remaining active admin account.
  if (user.userType === 'ADMIN') {
    const otherActiveAdmins = await User.countDocuments({
      userType: 'ADMIN',
      _id: { $ne: user._id },
      deletedAt: null,
      isActive: true,
    });
    if (otherActiveAdmins === 0) {
      res.status(409);
      throw new Error('Cannot delete the last remaining admin account');
    }
  }

  // Soft delete: anonymise the account so its references (orders, scans,
  // carts) keep resolving, free the unique email for re-registration, and
  // never touch any order/transaction records.
  user.deletedAt = new Date();
  user.isActive = false;
  user.name = 'Deleted User';
  user.email = `deleted-${user._id}@deleted.kisanai.local`;
  user.phone = '';
  user.password = randomBytes(24).toString('hex');
  await user.save();

  apiResponse(res, 200, true, 'User deleted. Their order history has been preserved.', {
    userId: user._id,
  });
});

// @desc    Upload a product image (Admin)
// @route   POST /api/admin/uploads/image
// @access  Admin
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please select an image to upload');
  }

  if (!cloudinaryConfigured) {
    res.status(503);
    throw new Error(
      'Image upload is not configured on the server. Set your Cloudinary credentials in the backend .env (CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).'
    );
  }

  let imageUrl;
  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'kisan-ai/products',
          resource_type: 'image',
          transformation: [{ width: 1024, height: 1024, crop: 'limit', quality: 'auto' }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });
    imageUrl = uploadResult.secure_url;
  } catch (cloudErr) {
    console.error(
      `[cloudinary] Upload failed (http_code=${cloudErr?.http_code || 'unknown'}): ` +
        `${cloudErr?.message || cloudErr}`
    );
    if (cloudErr?.http_code === 401 || cloudErr?.http_code === 403) {
      res.status(503);
      throw new Error(
        'Image storage is misconfigured on the server. Check Cloudinary credentials in the backend .env file.'
      );
    }
    res.status(500);
    throw new Error('Image upload failed. Please try again.');
  }

  apiResponse(res, 201, true, 'Image uploaded', { url: imageUrl });
});

// @desc    Get rich admin dashboard data (Admin)
// @route   GET /api/admin/dashboard
// @access  Admin
const getDashboard = asyncHandler(async (req, res) => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 13); // last 14 days (incl. today)

  const chartDay = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

  // Build a dense UTC day list so charts have no gaps.
  const dayList = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    dayList.push(d.toISOString().slice(0, 10));
  }

  const [
    totalUsers,
    totalAdmins,
    activeUsers,
    totalProducts,
    availableProducts,
    totalOrders,
    pendingOrders,
    totalGrainOrders,
    totalScans,
    recentUsers,
    recentOrders,
    recentProducts,
    revenueResult,
    grainRevenueResult,
    registrationsByDay,
    ordersByDay,
  ] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ deletedAt: null, userType: 'ADMIN' }),
    // "Active" here means enabled accounts — user activity tracking does not
    // exist in this project, so consumers must label this metric accordingly.
    User.countDocuments({ deletedAt: null, isActive: true }),
    Product.countDocuments(),
    Product.countDocuments({ stock: { $gt: 0 }, isActive: true }),
    Order.countDocuments(),
    Order.countDocuments({ status: 'PLACED' }),
    GrainOrder.countDocuments(),
    CropScan.countDocuments(),
    User.find({ deletedAt: null })
      .select('name email userType isActive createdAt')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Order.find().sort({ createdAt: -1 }).limit(6).populate('user', 'name email').lean(),
    Product.find()
      .sort({ updatedAt: -1 })
      .limit(6)
      .select('name category price stock isActive createdAt updatedAt')
      .lean(),
    Order.aggregate([
      { $match: { status: { $in: ['DELIVERED', 'CONFIRMED', 'SHIPPED'] } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
    GrainOrder.aggregate([
      { $match: { status: { $in: ['DELIVERED', 'CONFIRMED', 'DISPATCHED'] } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: from }, deletedAt: null } },
      { $group: { _id: chartDay, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: from } } },
      { $group: { _id: chartDay, count: { $sum: 1 } } },
    ]),
  ]);

  const fillChart = (rows) => {
    const map = new Map(rows.map((r) => [r._id, r.count]));
    return dayList.map((day) => ({ day, count: map.get(day) || 0 }));
  };

  const revenue = revenueResult[0]?.total || 0;
  const grainRevenue = grainRevenueResult[0]?.total || 0;

  apiResponse(res, 200, true, 'Dashboard data fetched', {
    stats: {
      totalUsers,
      totalAdmins,
      // NOTE: no per-session activity tracking exists — this counts enabled accounts.
      activeUsers,
      totalProducts,
      availableProducts,
      totalOrders,
      totalGrainOrders,
      totalScans,
      pendingOrders,
      revenue,
      grainRevenue,
      totalRevenue: revenue + grainRevenue,
    },
    charts: {
      registrations: fillChart(registrationsByDay),
      orders: fillChart(ordersByDay),
    },
    recentUsers,
    recentOrders,
    recentProducts,
  });
});

// @desc    Toggle user active status (Admin)
// @route   PUT /api/admin/users/:id/toggle
// @access  Admin
const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error('You cannot deactivate your own account');
  }

  user.isActive = !user.isActive;
  await user.save();

  apiResponse(res, 200, true, `User ${user.isActive ? 'activated' : 'deactivated'}`, {
    userId: user._id,
    isActive: user.isActive,
  });
});

export { getDashboardStats, getDashboard, getAllUsers, getUser, deleteUser, toggleUserStatus, uploadImage };
