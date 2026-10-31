import asyncHandler from 'express-async-handler';
import { getMandiPrices } from '../services/mandiService.js';
import MandiPrice from '../models/mandiPriceModel.js';
import apiResponse from '../utils/apiResponse.js';

// @desc    Get mandi prices
// @route   GET /api/mandi
// @access  Public
const getMandiList = asyncHandler(async (req, res) => {
  const { state, district, commodity, date, page = 1, limit = 30 } = req.query;

  const { data, source, message, isLive, lastUpdated, latestDate } =
    await getMandiPrices({ state, district, commodity, date });

  // Apply pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const start = (pageNum - 1) * limitNum;
  const paginated = data.slice(start, start + limitNum);

  // Mark seeded/manual demo records so the UI never labels them as live.
  const hasSeedOnly =
    paginated.length > 0 && paginated.every((p) => p.source === 'SEED' || p.source === 'MANUAL');

  apiResponse(res, 200, true, 'Mandi prices fetched', {
    prices: paginated,
    total: data.length,
    source,
    isLive,
    lastUpdated,
    latestDate,
    isSeedData: hasSeedOnly,
    priceUnit: '₹ per quintal',
    note: message,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: data.length,
      pages: Math.ceil(data.length / limitNum),
    },
  });
});

// @desc    Manually add/update mandi price (Admin)
// @route   POST /api/mandi
// @access  Admin
const addMandiPrice = asyncHandler(async (req, res) => {
  const { state, district, market, commodity, variety, minPrice, maxPrice, modalPrice, date } = req.body;

  if (!state || !district || !commodity?.en || !commodity?.hi) {
    res.status(400);
    throw new Error('state, district, and commodity (en+hi) are required');
  }

  const priceRecord = await MandiPrice.findOneAndUpdate(
    {
      state: state.trim(),
      district: district.trim(),
      'commodity.en': commodity.en.trim(),
      date: date || new Date().toISOString().split('T')[0],
    },
    {
      state: state.trim(),
      district: district.trim(),
      market: market || '',
      commodity,
      variety: variety || '',
      minPrice: Number(minPrice) || 0,
      maxPrice: Number(maxPrice) || 0,
      modalPrice: Number(modalPrice) || 0,
      date: date || new Date().toISOString().split('T')[0],
      fetchedAt: new Date(),
      source: 'MANUAL',
    },
    { upsert: true, new: true }
  );

  apiResponse(res, 201, true, 'Mandi price saved', priceRecord);
});

// @desc    Update mandi price (Admin)
// @route   PUT /api/mandi/:id
// @access  Admin
const updateMandiPrice = asyncHandler(async (req, res) => {
  const price = await MandiPrice.findById(req.params.id);
  if (!price) {
    res.status(404);
    throw new Error('Price record not found');
  }

  const { minPrice, maxPrice, modalPrice, market, variety } = req.body;
  if (minPrice !== undefined) price.minPrice = Number(minPrice);
  if (maxPrice !== undefined) price.maxPrice = Number(maxPrice);
  if (modalPrice !== undefined) price.modalPrice = Number(modalPrice);
  if (market !== undefined) price.market = market;
  if (variety !== undefined) price.variety = variety;
  price.source = 'MANUAL';
  price.fetchedAt = new Date();

  await price.save();
  apiResponse(res, 200, true, 'Price updated', price);
});

export { getMandiList, addMandiPrice, updateMandiPrice };
