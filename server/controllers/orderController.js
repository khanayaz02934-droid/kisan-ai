import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Cart from '../models/cartModel.js';
import Product from '../models/productModel.js';
import apiResponse from '../utils/apiResponse.js';
import { supportsTransactions } from '../utils/transactionSupport.js';

// @desc    Place order from cart
// @route   POST /api/orders
// @access  Private
const placeOrder = asyncHandler(async (req, res) => {
  const { address, notes } = req.body;

  if (!address?.fullName || !address?.phone || !address?.street || !address?.district || !address?.state || !address?.pincode) {
    res.status(400);
    throw new Error('Complete delivery address is required');
  }

  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');

  if (!cart || cart.items.length === 0) {
    res.status(400);
    throw new Error('Your cart is empty');
  }

  // Validate stock
  for (const item of cart.items) {
    const product = item.product;
    if (!product || !product.isActive) {
      res.status(400);
      throw new Error(`Product "${item.product?.name?.en || 'Unknown'}" is no longer available`);
    }
    if (product.stock < item.quantity) {
      res.status(400);
      throw new Error(`Insufficient stock for "${product.name.en}". Only ${product.stock} available.`);
    }
  }

  const orderItems = cart.items.map((item) => ({
    product: item.product._id,
    name: item.product.name,
    quantity: item.quantity,
    price: item.product.price,
    image: item.product.image,
  }));

  const totalPrice = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Transactions require a replica set; stand-alone dev servers don't have one.
  // Use the same atomicity guarantees when available, sequential writes otherwise.
  if (await supportsTransactions()) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: -item.quantity } }, { session });
      }

      const [order] = await Order.create([{ user: req.user._id, items: orderItems, address, totalPrice, paymentMethod: 'COD', notes: notes || '' }], { session });

      cart.items = [];
      await cart.save({ session });

      await session.commitTransaction();

      apiResponse(res, 201, true, 'Order placed successfully', order);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    return;
  }

  // Fallback flow (stand-alone MongoDB): sequential writes with best-effort
  // compensation so a mid-way failure does not leave stock wrongly deducted.
  try {
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: -item.quantity } });
    }

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      address,
      totalPrice,
      paymentMethod: 'COD',
      notes: notes || '',
    });

    cart.items = [];
    await cart.save();

    apiResponse(res, 201, true, 'Order placed successfully', order);
  } catch (error) {
    // Best-effort stock restore if the order was not placed
    try {
      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: item.quantity } });
      }
    } catch (restoreErr) {
      console.error('Stock restore failed:', restoreErr.message);
    }
    throw error;
  }
});

// @desc    Get my orders
// @route   GET /api/orders/my
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Order.countDocuments({ user: req.user._id }),
  ]);

  apiResponse(res, 200, true, 'Orders fetched', {
    orders,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).lean();

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // User can only see their own orders; admin can see all
  if (order.user.toString() !== req.user._id.toString() && req.user.userType !== 'ADMIN') {
    res.status(403);
    throw new Error('Access denied');
  }

  apiResponse(res, 200, true, 'Order fetched', order);
});

// @desc    Get all orders (Admin)
// @route   GET /api/orders/admin/all
// @access  Admin
const getAllOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (status) query.status = status.toUpperCase();

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(query),
  ]);

  apiResponse(res, 200, true, 'All orders fetched', {
    orders,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Admin
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  if (!status || !validStatuses.includes(status.toUpperCase())) {
    res.status(400);
    throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // If cancelling, restore stock
  if (status.toUpperCase() === 'CANCELLED' && order.status !== 'CANCELLED') {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }
  }

  order.status = status.toUpperCase();
  await order.save();

  apiResponse(res, 200, true, 'Order status updated', order);
});

export { placeOrder, getMyOrders, getOrder, getAllOrders, updateOrderStatus };
