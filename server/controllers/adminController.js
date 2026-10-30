import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import CropScan from '../models/cropScanModel.js';
import GrainOrder from '../models/grainOrderModel.js';
import Product from '../models/productModel.js';
import Grain from '../models/grainModel.js';
import apiResponse from '../utils/apiResponse.js';
import { escapeRegExp } from '../utils/escapeRegExp.js';

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
  const { page = 1, limit = 20, search } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
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

export { getDashboardStats, getAllUsers, toggleUserStatus };
