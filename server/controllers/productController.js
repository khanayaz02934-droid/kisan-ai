import asyncHandler from 'express-async-handler';
import Product from '../models/productModel.js';
import apiResponse from '../utils/apiResponse.js';
import { escapeRegExp } from '../utils/escapeRegExp.js';

// @desc    Get all products (public, with search/filter/pagination)
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const { search, category, page = 1, limit = 12, minPrice, maxPrice, inStock } = req.query;

  const query = { isActive: true };

  if (category) query.category = category.toUpperCase();
  if (inStock === 'true') query.stock = { $gt: 0 };

  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  if (search) {
    const searchPattern = new RegExp(escapeRegExp(search), 'i');
    query.$or = [
      { 'name.en': searchPattern },
      { 'name.hi': searchPattern },
      { tags: searchPattern },
    ];
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Product.countDocuments(query),
  ]);

  apiResponse(res, 200, true, 'Products fetched', {
    products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).lean();

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  apiResponse(res, 200, true, 'Product fetched', product);
});

// @desc    Create product (Admin)
// @route   POST /api/products
// @access  Admin
const createProduct = asyncHandler(async (req, res) => {
  const { name, description, category, tags, price, unit, stock, image, expireOn } = req.body;

  if (!name?.en || !name?.hi || !category || price === undefined || stock === undefined) {
    res.status(400);
    throw new Error('name (en+hi), category, price, and stock are required');
  }

  const product = await Product.create({
    name,
    description: description || { en: '', hi: '' },
    category: category.toUpperCase(),
    tags: tags || [],
    price: Number(price),
    unit: unit || '500ml',
    stock: Number(stock),
    image: image || '',
    expireOn: expireOn || undefined,
  });

  apiResponse(res, 201, true, 'Product created', product);
});

// @desc    Update product (Admin)
// @route   PUT /api/products/:id
// @access  Admin
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const { name, description, category, tags, price, unit, stock, image, expireOn, isActive } = req.body;

  if (name) product.name = name;
  if (description) product.description = description;
  if (category) product.category = category.toUpperCase();
  if (tags !== undefined) product.tags = tags;
  if (price !== undefined) product.price = Number(price);
  if (unit) product.unit = unit;
  if (stock !== undefined) product.stock = Number(stock);
  if (image !== undefined) product.image = image;
  if (expireOn !== undefined) product.expireOn = expireOn;
  if (isActive !== undefined) product.isActive = isActive;

  const updated = await product.save();
  apiResponse(res, 200, true, 'Product updated', updated);
});

// @desc    Delete product (Admin)
// @route   DELETE /api/products/:id
// @access  Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  await product.deleteOne();
  apiResponse(res, 200, true, 'Product deleted', null);
});

export { getProducts, getProduct, createProduct, updateProduct, deleteProduct };
