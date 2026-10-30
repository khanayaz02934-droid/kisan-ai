import asyncHandler from 'express-async-handler';
import GrainOrder from '../models/grainOrderModel.js';
import Grain from '../models/grainModel.js';
import apiResponse from '../utils/apiResponse.js';

// @desc    Place a grain order
// @route   POST /api/grain-orders
// @access  Private
const placeGrainOrder = asyncHandler(async (req, res) => {
  const { grainId, quantityQuintal, address, notes } = req.body;

  if (!grainId || !quantityQuintal || !address?.fullName || !address?.phone ||
      !address?.street || !address?.district || !address?.state || !address?.pincode) {
    res.status(400);
    throw new Error('Grain ID, quantity, and complete address are required');
  }

  const qty = parseFloat(quantityQuintal);
  if (isNaN(qty) || qty <= 0) {
    res.status(400);
    throw new Error('Invalid quantity');
  }

  const grain = await Grain.findById(grainId);
  if (!grain || !grain.isActive) {
    res.status(404);
    throw new Error('Grain listing not found or unavailable');
  }

  if (qty < grain.minOrderQuintal) {
    res.status(400);
    throw new Error(`Minimum order is ${grain.minOrderQuintal} quintal`);
  }

  if (qty > grain.availableQuintal) {
    res.status(400);
    throw new Error(`Only ${grain.availableQuintal} quintal available`);
  }

  // Deduct stock
  grain.availableQuintal -= qty;
  await grain.save();

  const totalPrice = qty * grain.pricePerQuintal;

  const grainOrder = await GrainOrder.create({
    user: req.user._id,
    grain: grainId,
    grainName: grain.name,
    quantityQuintal: qty,
    pricePerQuintal: grain.pricePerQuintal,
    totalPrice,
    address,
    notes: notes || '',
  });

  apiResponse(res, 201, true, 'Grain order placed successfully', grainOrder);
});

// @desc    Get my grain orders
// @route   GET /api/grain-orders/my
// @access  Private
const getMyGrainOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    GrainOrder.find({ user: req.user._id })
      .populate('grain', 'name type images location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    GrainOrder.countDocuments({ user: req.user._id }),
  ]);

  apiResponse(res, 200, true, 'Grain orders fetched', {
    orders,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Get all grain orders (Admin)
// @route   GET /api/grain-orders/admin/all
// @access  Admin
const getAllGrainOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (status) query.status = status.toUpperCase();

  const [orders, total] = await Promise.all([
    GrainOrder.find(query)
      .populate('user', 'name email phone')
      .populate('grain', 'name type location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    GrainOrder.countDocuments(query),
  ]);

  apiResponse(res, 200, true, 'All grain orders fetched', {
    orders,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Update grain order status (Admin)
// @route   PUT /api/grain-orders/:id/status
// @access  Admin
const updateGrainOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['PLACED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];

  if (!status || !validStatuses.includes(status.toUpperCase())) {
    res.status(400);
    throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  const order = await GrainOrder.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Grain order not found');
  }

  // Restore stock on cancellation
  if (status.toUpperCase() === 'CANCELLED' && order.status !== 'CANCELLED') {
    await Grain.findByIdAndUpdate(order.grain, {
      $inc: { availableQuintal: order.quantityQuintal },
    });
  }

  order.status = status.toUpperCase();
  await order.save();

  apiResponse(res, 200, true, 'Grain order status updated', order);
});

export { placeGrainOrder, getMyGrainOrders, getAllGrainOrders, updateGrainOrderStatus };
