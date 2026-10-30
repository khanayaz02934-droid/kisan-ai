import asyncHandler from 'express-async-handler';
import Cart from '../models/cartModel.js';
import Product from '../models/productModel.js';
import apiResponse from '../utils/apiResponse.js';

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id })
    .populate('items.product', 'name description price unit stock image isActive');

  if (!cart) {
    cart = { user: req.user._id, items: [] };
  }

  // Filter out inactive products
  const validItems = cart.items
    ? cart.items.filter((item) => item.product && item.product.isActive)
    : [];

  const totalPrice = validItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  apiResponse(res, 200, true, 'Cart fetched', {
    items: validItems,
    totalPrice,
    itemCount: validItems.reduce((sum, item) => sum + item.quantity, 0),
  });
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    res.status(400);
    throw new Error('Product ID is required');
  }

  const qty = Math.max(1, parseInt(quantity));
  const product = await Product.findById(productId);

  if (!product || !product.isActive) {
    res.status(404);
    throw new Error('Product not found or unavailable');
  }

  if (product.stock < qty) {
    res.status(400);
    throw new Error(`Only ${product.stock} units available in stock`);
  }

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  const existingItemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (existingItemIndex >= 0) {
    const newQty = cart.items[existingItemIndex].quantity + qty;
    if (newQty > product.stock) {
      res.status(400);
      throw new Error(`Cannot add more than ${product.stock} units`);
    }
    cart.items[existingItemIndex].quantity = newQty;
  } else {
    cart.items.push({ product: productId, quantity: qty });
  }

  await cart.save();

  // Return populated cart
  const populatedCart = await Cart.findById(cart._id).populate(
    'items.product',
    'name price unit stock image'
  );

  apiResponse(res, 200, true, 'Item added to cart', populatedCart);
});

// @desc    Update cart item quantity
// @route   PATCH /api/cart/:productId
// @access  Private
const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const { productId } = req.params;

  if (!quantity || quantity < 1) {
    res.status(400);
    throw new Error('Quantity must be at least 1');
  }

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  if (product.stock < quantity) {
    res.status(400);
    throw new Error(`Only ${product.stock} units available`);
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error('Cart not found');
  }

  const itemIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId
  );

  if (itemIndex === -1) {
    res.status(404);
    throw new Error('Item not found in cart');
  }

  cart.items[itemIndex].quantity = parseInt(quantity);
  await cart.save();

  const populated = await Cart.findById(cart._id).populate(
    'items.product',
    'name price unit stock image'
  );

  apiResponse(res, 200, true, 'Cart updated', populated);
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/:productId
// @access  Private
const removeFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    res.status(404);
    throw new Error('Cart not found');
  }

  cart.items = cart.items.filter((item) => item.product.toString() !== productId);
  await cart.save();

  apiResponse(res, 200, true, 'Item removed from cart', null);
});

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (cart) {
    cart.items = [];
    await cart.save();
  }
  apiResponse(res, 200, true, 'Cart cleared', null);
});

export { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
