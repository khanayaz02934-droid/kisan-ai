import asyncHandler from 'express-async-handler';
import cloudinary, { cloudinaryConfigured } from '../config/cloudinary.js';
import { analyzeCropImage, GeminiUnavailableError } from '../services/geminiService.js';
import { matchProductsByKeywords } from '../services/matchingService.js';
import CropScan from '../models/cropScanModel.js';
import apiResponse from '../utils/apiResponse.js';

// @desc    Upload and analyze crop image
// @route   POST /api/scans
// @access  Private
const createScan = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('Please upload a crop image');
  }

  if (!cloudinaryConfigured) {
    res.status(503);
    throw new Error(
      'Image storage is not configured on the server. Set Cloudinary credentials in the backend .env file.'
    );
  }

  // AI provider availability check — surface configuration problems clearly
  // instead of storing a confusing NEEDS_REVIEW scan record.
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!geminiKey || geminiKey.includes('...') || geminiKey.includes('your_')) {
    res.status(503);
    throw new Error(
      'AI analysis is not configured on the server. Set GEMINI_API_KEY in the backend .env file.'
    );
  }

  // Upload to Cloudinary
  let imageUrl;
  try {
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'kisan-ai/scans',
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
    // Log the real cause server-side. Cloudinary errors never contain the
    // api_secret, so this is safe to print — never log env values themselves.
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

  // Analyze with Gemini
  let scanStatus = 'COMPLETED';
  let reviewMessage = null;
  let result = null;
  let matchedProducts = [];

  try {
    const { success, data, error } = await analyzeCropImage(req.file.buffer, req.file.mimetype);

    if (!success || !data) {
      scanStatus = 'NEEDS_REVIEW';
      reviewMessage = {
        en: 'Photo unclear, please retake a closer, well-lit photo of the affected crop',
        hi: 'फोटो अस्पष्ट है, कृपया प्रभावित फसल की नज़दीकी, अच्छी रोशनी वाली फोटो फिर से खींचें',
      };
    } else if (data.confidence < 0.6) {
      scanStatus = 'NEEDS_REVIEW';
      reviewMessage = {
        en: `Low confidence (${Math.round(data.confidence * 100)}%). Photo unclear, please retake with better lighting.`,
        hi: `कम विश्वास (${Math.round(data.confidence * 100)}%)। फोटो अस्पष्ट है, बेहतर रोशनी में फिर से खींचें।`,
      };
      result = data;
    } else {
      result = data;
      // Match products
      matchedProducts = await matchProductsByKeywords(data.medicineKeywords || []);
    }
  } catch (aiErr) {
    console.error('Gemini analysis error:', aiErr.message);
    scanStatus = 'NEEDS_REVIEW';
    // Honest failure: a GeminiUnavailableError means every retry/fallback
    // attempt hit temporary unavailability; anything else (auth, invalid
    // request, wrong model) is a configuration problem. Neither ever
    // fabricates a diagnosis.
    reviewMessage = aiErr instanceof GeminiUnavailableError
      ? {
          en: 'AI analysis is temporarily unavailable due to high demand. Please try again shortly or consult your local agriculture expert.',
          hi: 'अधिक भीड़ के कारण AI विश्लेषण अस्थायी रूप से उपलब्ध नहीं है। कृपया थोड़ी देर बाद पुनः प्रयास करें या अपने स्थानीय कृषि विशेषज्ञ से परामर्श करें।',
        }
      : {
          en: 'AI analysis is misconfigured on the server. Please consult your local agriculture expert meanwhile.',
          hi: 'सर्वर पर AI विश्लेषण सही ढंग से सेटअप नहीं है। इस बीच कृपया अपने स्थानीय कृषि विशेषज्ञ से परामर्श करें।',
        };
  }

  // Save scan to DB
  const matchedProductIds = matchedProducts.map((p) => p._id);
  const scan = await CropScan.create({
    user: req.user._id,
    imageUrl,
    result,
    status: scanStatus,
    reviewMessage,
    matchedProducts: matchedProductIds,
  });

  apiResponse(res, 201, true, 'Scan completed', {
    scan: {
      ...scan.toObject(),
      matchedProducts,
    },
    disclaimer: {
      en: 'AI results may be inaccurate. Consult a certified agriculture expert for serious crop diseases.',
      hi: 'AI परिणाम गलत हो सकते हैं। गंभीर फसल रोगों के लिए प्रमाणित कृषि विशेषज्ञ से सलाह लें।',
    },
  });
});

// @desc    Get my scan history
// @route   GET /api/scans
// @access  Private
const getMyScans = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const [scans, total] = await Promise.all([
    CropScan.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('matchedProducts', 'name price image stock')
      .lean(),
    CropScan.countDocuments({ user: req.user._id }),
  ]);

  apiResponse(res, 200, true, 'Scan history fetched', {
    scans,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

// @desc    Get single scan
// @route   GET /api/scans/:id
// @access  Private
const getScan = asyncHandler(async (req, res) => {
  const scan = await CropScan.findById(req.params.id)
    .populate('matchedProducts', 'name description price unit stock image category tags')
    .lean();

  if (!scan) {
    res.status(404);
    throw new Error('Scan not found');
  }

  if (scan.user.toString() !== req.user._id.toString() && req.user.userType !== 'ADMIN') {
    res.status(403);
    throw new Error('Access denied');
  }

  // Add addToCartUrl to matched products
  const matchedWithUrl = (scan.matchedProducts || []).map((p) => ({
    ...p,
    addToCartUrl: `/cart/add/${p._id}`,
  }));

  apiResponse(res, 200, true, 'Scan fetched', {
    ...scan,
    matchedProducts: matchedWithUrl,
    disclaimer: {
      en: 'AI results may be inaccurate. Consult a certified agriculture expert for serious crop diseases.',
      hi: 'AI परिणाम गलत हो सकते हैं। गंभीर फसल रोगों के लिए प्रमाणित कृषि विशेषज्ञ से सलाह लें।',
    },
  });
});

// @desc    Get all scans (Admin)
// @route   GET /api/scans/admin/all
// @access  Admin
const getAllScans = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (status) query.status = status.toUpperCase();

  const [scans, total] = await Promise.all([
    CropScan.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    CropScan.countDocuments(query),
  ]);

  apiResponse(res, 200, true, 'All scans fetched', {
    scans,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
});

export { createScan, getMyScans, getScan, getAllScans };
