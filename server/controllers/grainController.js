import asyncHandler from 'express-async-handler';
import Grain from '../models/grainModel.js';
import apiResponse from '../utils/apiResponse.js';
import { escapeRegExp } from '../utils/escapeRegExp.js';

// @desc    Get all grains (public, with filters)
// @route   GET /api/grain
// @access  Public
const getGrains = asyncHandler(async (req, res) => {
  const { type, isOrganic, minPrice, maxPrice, state, page = 1, limit = 12 } = req.query;

  const query = { isActive: true, availableQuintal: { $gt: 0 } };

  if (type) query.type = type.toUpperCase();
  if (isOrganic === 'true') query.isOrganic = true;
  if (state) query.state = new RegExp(state, 'i');

  if (minPrice || maxPrice) {
    query.pricePerQuintal = {};
    if (minPrice) query.pricePerQuintal.$gte = Number(minPrice);
    if (maxPrice) query.pricePerQuintal.$lte = Number(maxPrice);
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [grains, total] = await Promise.all([
    Grain.find(query)
      .populate('seller', 'name phone state district')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Grain.countDocuments(query),
  ]);

  apiResponse(res, 200, true, 'Grain listings fetched', {
    grains,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Get ALL grain listings, including sold-out / inactive (Admin).
//          The public list hides grains with availableQuintal=0 or isActive=false,
//          which would make a sold-out grain impossible to restock from the UI.
// @route   GET /api/grain/admin/all
// @access  Admin
const getAllGrainsAdmin = asyncHandler(async (req, res) => {
  const { type, state, search, page = 1, limit = 20 } = req.query;

  const query = {};
  if (type) query.type = type.toUpperCase();
  if (state) query.state = new RegExp(escapeRegExp(state), 'i');
  if (search) {
    const searchPattern = new RegExp(escapeRegExp(search), 'i');
    query.$or = [
      { 'name.en': searchPattern },
      { 'name.hi': searchPattern },
      { variety: searchPattern },
    ];
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [grains, total] = await Promise.all([
    Grain.find(query)
      .populate('seller', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Grain.countDocuments(query),
  ]);

  apiResponse(res, 200, true, 'All grain listings fetched', {
    grains,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Get single grain
// @route   GET /api/grain/:id
// @access  Public
const getGrain = asyncHandler(async (req, res) => {
  const grain = await Grain.findById(req.params.id)
    .populate('seller', 'name phone state district village')
    .lean();

  if (!grain || !grain.isActive) {
    res.status(404);
    throw new Error('Grain listing not found');
  }

  apiResponse(res, 200, true, 'Grain fetched', grain);
});

// @desc    Create grain listing (Admin)
// @route   POST /api/grain
// @access  Admin
const createGrain = asyncHandler(async (req, res) => {
  const {
    name, type, variety, description, pricePerQuintal,
    minOrderQuintal, availableQuintal, location, state, district,
    images, isOrganic,
  } = req.body;

  if (!name?.en || !name?.hi || !type || !pricePerQuintal || !location) {
    res.status(400);
    throw new Error('name (en+hi), type, pricePerQuintal, and location are required');
  }

  const grain = await Grain.create({
    name,
    type: type.toUpperCase(),
    variety: variety || '',
    description: description || { en: '', hi: '' },
    pricePerQuintal: Number(pricePerQuintal),
    minOrderQuintal: Number(minOrderQuintal) || 1,
    availableQuintal: Number(availableQuintal) || 0,
    location,
    state: state || '',
    district: district || '',
    images: images || [],
    isOrganic: isOrganic === true || isOrganic === 'true',
    seller: req.user._id,
  });

  apiResponse(res, 201, true, 'Grain listing created', grain);
});

// @desc    Update grain (Admin)
// @route   PUT /api/grain/:id
// @access  Admin
const updateGrain = asyncHandler(async (req, res) => {
  const grain = await Grain.findById(req.params.id);
  if (!grain) {
    res.status(404);
    throw new Error('Grain listing not found');
  }

  const fields = ['name', 'variety', 'description', 'pricePerQuintal', 'minOrderQuintal',
    'availableQuintal', 'location', 'state', 'district', 'images', 'isOrganic', 'isActive'];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      grain[field] = req.body[field];
    }
  }

  if (req.body.type) grain.type = req.body.type.toUpperCase();

  const updated = await grain.save();
  apiResponse(res, 200, true, 'Grain updated', updated);
});

// @desc    Delete grain (Admin)
// @route   DELETE /api/grain/:id
// @access  Admin
const deleteGrain = asyncHandler(async (req, res) => {
  const grain = await Grain.findById(req.params.id);
  if (!grain) {
    res.status(404);
    throw new Error('Grain listing not found');
  }

  await grain.deleteOne();
  apiResponse(res, 200, true, 'Grain listing deleted', null);
});

export { getGrains, getAllGrainsAdmin, getGrain, createGrain, updateGrain, deleteGrain };
