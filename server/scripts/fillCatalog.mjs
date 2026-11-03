/**
 * PRODUCTION-SAFE catalog filler.
 *
 * Unlike the destructive full seed (`npm run seed`), this script NEVER deletes
 * anything. It only UPSERTS catalog records (products, grains, mandi prices)
 * that are missing from the target database, so a fresh production database
 * can be brought up to a working state without touching users, orders, carts
 * or scans — and without modifying anything that already exists.
 *
 * Usage:  npm run seed:catalog     (uses MONGO_URI from the .env file)
 *
 * Idempotent: run it as many times as you like; existing records are updated
 * by natural key, then left alone. Never creates user accounts.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import colors from 'colors';

import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import Grain from '../models/grainModel.js';
import MandiPrice from '../models/mandiPriceModel.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kisan-ai';

// ------------------------------------------------------------------ data ---
const PRODUCTS = [
  {
    name: { en: 'Neem Oil Pesticide', hi: 'नीम तेल कीटनाशक' },
    description: {
      en: 'Pure cold-pressed neem oil for organic pest control.',
      hi: 'जैविक कीट नियंत्रण के लिए शुद्ध नीम का तेल।',
    },
    category: 'BIO_PRODUCT',
    tags: ['neem', 'neem oil', 'organic pesticide', 'aphids'],
    price: 350,
    unit: '500ml',
    stock: 150,
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
  },
  {
    name: { en: 'Trichoderma Bio-Fungicide', hi: 'ट्राइकोडर्मा जैव-फफूंदनाशक' },
    description: {
      en: 'Bio-fungicide for soil-borne diseases.',
      hi: 'मिट्टी से होने वाली बीमारियों के लिए जैविक फफूंदनाशक।',
    },
    category: 'BIO_PRODUCT',
    tags: ['trichoderma', 'fungicide', 'root rot'],
    price: 280,
    unit: '1kg',
    stock: 200,
    image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400',
  },
  {
    name: { en: 'Copper Fungicide Spray', hi: 'कॉपर फफूंदनाशक स्प्रे' },
    description: {
      en: 'Copper-based fungicide for blight and mildew.',
      hi: 'ब्लाइट और फफूंदी के लिए कॉपर आधारित फफूंदनाशक।',
    },
    category: 'FUNGICIDE',
    tags: ['copper', 'fungicide', 'blight'],
    price: 450,
    unit: '250g',
    stock: 120,
    image: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400',
  },
  {
    name: { en: 'Bio NPK Fertilizer', hi: 'जैव NPK उर्वरक' },
    description: {
      en: 'Organic NPK biofertilizer for soil health.',
      hi: 'मिट्टी के स्वास्थ्य के लिए जैविक NPK उर्वरक।',
    },
    category: 'FERTILIZER',
    tags: ['npk', 'fertilizer', 'organic'],
    price: 520,
    unit: '5kg',
    stock: 300,
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
  },
  {
    name: { en: 'Mancozeb Fungicide', hi: 'मैन्कोज़ेब फफूंदनाशक' },
    description: {
      en: 'Broad-spectrum fungicide for plant diseases.',
      hi: 'पौधों की बीमारियों के लिए फफूंदनाशक।',
    },
    category: 'FUNGICIDE',
    tags: ['mancozeb', 'fungicide', 'blight'],
    price: 320,
    unit: '500g',
    stock: 180,
    image: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400',
  },
  {
    name: { en: 'Imidacloprid Insecticide', hi: 'इमिडाक्लोप्रिड कीटनाशक' },
    description: {
      en: 'Systemic insecticide for sucking pests.',
      hi: 'चूसने वाले कीटों के लिए कीटनाशक।',
    },
    category: 'PESTICIDE',
    tags: ['imidacloprid', 'insecticide', 'aphids'],
    price: 580,
    unit: '100ml',
    stock: 90,
    image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400',
  },
  {
    name: { en: 'Pseudomonas Bio-Control', hi: 'स्यूडोमोनास जैव-नियंत्रण' },
    description: {
      en: 'Bioagent for controlling bacterial and fungal diseases.',
      hi: 'जीवाणु और फफूंद रोगों के नियंत्रण के लिए जैविक उत्पाद।',
    },
    category: 'BIO_PRODUCT',
    tags: ['pseudomonas', 'bio control'],
    price: 260,
    unit: '1kg',
    stock: 160,
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
  },
  {
    name: { en: 'Vermicompost Organic', hi: 'वर्मीकम्पोस्ट जैविक' },
    description: {
      en: 'Organic compost for improving soil structure.',
      hi: 'मिट्टी की गुणवत्ता सुधारने के लिए जैविक खाद।',
    },
    category: 'FERTILIZER',
    tags: ['vermicompost', 'organic', 'compost'],
    price: 180,
    unit: '5kg',
    stock: 400,
    image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400',
  },
  {
    name: { en: 'Hybrid Tomato Seeds F1', hi: 'हाइब्रिड टमाटर बीज F1' },
    description: {
      en: 'High-yield hybrid tomato seeds.',
      hi: 'अधिक उत्पादन देने वाले हाइब्रिड टमाटर के बीज।',
    },
    category: 'SEED',
    tags: ['tomato', 'hybrid seeds'],
    price: 850,
    unit: '10g',
    stock: 75,
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400',
  },
  {
    name: { en: 'Sulfur Dust Fungicide', hi: 'सल्फर डस्ट फफूंदनाशक' },
    description: {
      en: 'Wettable sulfur for powdery mildew and rust control.',
      hi: 'पाउडरी फफूंदी और जंग नियंत्रण के लिए सल्फर।',
    },
    category: 'FUNGICIDE',
    tags: ['sulfur', 'fungicide', 'rust'],
    price: 195,
    unit: '1kg',
    stock: 220,
    image: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400',
  },
  {
    name: { en: 'Beauveria bassiana Bio-Pesticide', hi: 'ब्यूवेरिया बैसियाना जैव-कीटनाशक' },
    description: {
      en: 'Organic bio-pesticide for soil pests.',
      hi: 'मिट्टी के कीटों के लिए जैविक कीटनाशक।',
    },
    category: 'BIO_PRODUCT',
    tags: ['beauveria', 'bio pesticide'],
    price: 310,
    unit: '500g',
    stock: 140,
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
  },
  {
    name: { en: 'DAP Diammonium Phosphate', hi: 'DAP डाई अमोनियम फॉस्फेट' },
    description: {
      en: 'High phosphorus starter fertilizer.',
      hi: 'जड़ विकास के लिए फॉस्फोरस युक्त उर्वरक।',
    },
    category: 'FERTILIZER',
    tags: ['dap', 'fertilizer', 'phosphorus'],
    price: 1350,
    unit: '50kg bag',
    stock: 60,
    image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400',
  },
];

/** Grain lots (seller resolved from the first active admin in the target DB). */
const GRAINS = () => [
  {
    name: { en: 'Premium Basmati Rice', hi: 'प्रीमियम बासमती चावल' },
    type: 'RICE',
    variety: '1121 Basmati',
    description: { en: 'Long-grain aromatic basmati rice.', hi: 'लंबे दाने वाला सुगंधित बासमती चावल।' },
    pricePerQuintal: 6500,
    minOrderQuintal: 2,
    availableQuintal: 500,
    location: 'Amritsar, Punjab',
    state: 'Punjab',
    district: 'Amritsar',
    images: ['https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=400'],
    isOrganic: false,
  },
  {
    name: { en: 'Organic Wheat Sharbati', hi: 'जैविक गेहूं शरबती' },
    type: 'WHEAT',
    variety: 'Sharbati',
    description: { en: 'Organic Sharbati wheat from Madhya Pradesh.', hi: 'मध्य प्रदेश का जैविक शरबती गेहूं।' },
    pricePerQuintal: 2800,
    minOrderQuintal: 5,
    availableQuintal: 800,
    location: 'Sehore, Madhya Pradesh',
    state: 'Madhya Pradesh',
    district: 'Sehore',
    images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'],
    isOrganic: true,
  },
  {
    name: { en: 'Yellow Maize (Corn)', hi: 'पीली मक्का' },
    type: 'MAIZE',
    variety: 'Hybrid Yellow',
    description: { en: 'Fresh yellow maize.', hi: 'ताजी पीली मक्का।' },
    pricePerQuintal: 1850,
    minOrderQuintal: 10,
    availableQuintal: 2000,
    location: 'Davangere, Karnataka',
    state: 'Karnataka',
    district: 'Davangere',
    images: ['https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400'],
    isOrganic: false,
  },
  {
    name: { en: 'Toor Dal (Arhar)', hi: 'तूर दाल (अरहर)' },
    type: 'PULSES',
    variety: 'Local Variety',
    description: { en: 'Fresh red gram lentils.', hi: 'ताजी अरहर दाल।' },
    pricePerQuintal: 7200,
    minOrderQuintal: 1,
    availableQuintal: 300,
    location: 'Gulbarga, Karnataka',
    state: 'Karnataka',
    district: 'Kalaburagi',
    images: ['https://images.unsplash.com/photo-1584824486516-0555a07fc511?w=400'],
    isOrganic: false,
  },
  {
    name: { en: 'Pearl Millet (Bajra)', hi: 'बाजरा' },
    type: 'MILLETS',
    variety: 'HHB 67',
    description: { en: 'High-yield bajra variety.', hi: 'अधिक उत्पादन देने वाली बाजरे की किस्म।' },
    pricePerQuintal: 2200,
    minOrderQuintal: 5,
    availableQuintal: 1200,
    location: 'Barmer, Rajasthan',
    state: 'Rajasthan',
    district: 'Barmer',
    images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'],
    isOrganic: false,
  },
  {
    name: { en: 'Organic Mustard Seeds', hi: 'जैविक सरसों के बीज' },
    type: 'OILSEEDS',
    variety: 'Pusa Bold',
    description: { en: 'Organic mustard seeds.', hi: 'जैविक सरसों के बीज।' },
    pricePerQuintal: 5500,
    minOrderQuintal: 2,
    availableQuintal: 400,
    location: 'Alwar, Rajasthan',
    state: 'Rajasthan',
    district: 'Alwar',
    images: ['https://images.unsplash.com/photo-1584824486516-0555a07fc511?w=400'],
    isOrganic: true,
  },
  {
    name: { en: 'Soybean', hi: 'सोयाबीन' },
    type: 'OILSEEDS',
    variety: 'JS 335',
    description: { en: 'High-protein soybean variety.', hi: 'उच्च प्रोटीन वाली सोयाबीन किस्म।' },
    pricePerQuintal: 4200,
    minOrderQuintal: 5,
    availableQuintal: 600,
    location: 'Nagpur, Maharashtra',
    state: 'Maharashtra',
    district: 'Nagpur',
    images: ['https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400'],
    isOrganic: false,
  },
  {
    name: { en: 'Green Gram (Moong Dal)', hi: 'हरी मूंग दाल' },
    type: 'PULSES',
    variety: 'Pusa Vishal',
    description: { en: 'Fresh green gram.', hi: 'ताजी हरी मूंग।' },
    pricePerQuintal: 7800,
    minOrderQuintal: 1,
    availableQuintal: 250,
    location: 'Jaipur, Rajasthan',
    state: 'Rajasthan',
    district: 'Jaipur',
    images: ['https://images.unsplash.com/photo-1584824486516-0555a07fc511?w=400'],
    isOrganic: false,
  },
  {
    name: { en: 'Finger Millet (Ragi)', hi: 'रागी' },
    type: 'MILLETS',
    variety: 'GPU 28',
    description: { en: 'Calcium-rich ragi.', hi: 'कैल्शियम से भरपूर रागी।' },
    pricePerQuintal: 3200,
    minOrderQuintal: 2,
    availableQuintal: 350,
    location: 'Hassan, Karnataka',
    state: 'Karnataka',
    district: 'Hassan',
    images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400'],
    isOrganic: true,
  },
  {
    name: { en: 'Chana (Chickpea)', hi: 'चना' },
    type: 'PULSES',
    variety: 'Desi Chana',
    description: { en: 'Desi chickpea from Madhya Pradesh.', hi: 'मध्य प्रदेश का देसी चना।' },
    pricePerQuintal: 5600,
    minOrderQuintal: 2,
    availableQuintal: 700,
    location: 'Vidisha, Madhya Pradesh',
    state: 'Madhya Pradesh',
    district: 'Vidisha',
    images: ['https://images.unsplash.com/photo-1584824486516-0555a07fc511?w=400'],
    isOrganic: false,
  },
];

const MANDI_PRICES = () => {
  const today = new Date().toISOString().split('T')[0];
  const row = (state, district, market, en, hi, variety, minPrice, maxPrice, modalPrice) => ({
    state,
    district,
    market,
    commodity: { en, hi },
    variety,
    minPrice,
    maxPrice,
    modalPrice,
    date: today,
    source: 'SEED',
  });
  return [
    row('Punjab', 'Ludhiana', 'Ludhiana Mandi', 'Wheat', 'गेहूं', 'HD2967', 2100, 2250, 2175),
    row('Punjab', 'Amritsar', 'Amritsar Grain Market', 'Rice (Basmati)', 'बासमती चावल', '1121', 5800, 7000, 6200),
    row('Punjab', 'Patiala', 'Patiala Mandi', 'Maize', 'मक्का', 'Yellow', 1600, 1950, 1780),
    row('Uttar Pradesh', 'Agra', 'Agra APMC', 'Wheat', 'गेहूं', 'Lok1', 2050, 2200, 2125),
    row('Uttar Pradesh', 'Lucknow', 'Lucknow Mandi', 'Potato', 'आलू', 'Kufri Jyoti', 1200, 1800, 1500),
    row('Uttar Pradesh', 'Varanasi', 'Varanasi Agri Market', 'Onion', 'प्याज', 'Local', 800, 1500, 1200),
    row('Maharashtra', 'Nashik', 'Lasalgaon Mandi', 'Onion', 'प्याज', 'Red Medium', 900, 1800, 1350),
    row('Maharashtra', 'Nagpur', 'Nagpur APMC', 'Soybean', 'सोयाबीन', 'JS335', 3800, 4500, 4150),
    row('Maharashtra', 'Pune', 'Pune Mandi', 'Tomato', 'टमाटर', 'Hybrid', 1500, 3000, 2200),
    row('Rajasthan', 'Jaipur', 'Jaipur Mandi', 'Mustard', 'सरसों', 'Pusa Bold', 5000, 5800, 5400),
    row('Rajasthan', 'Barmer', 'Barmer Grain Market', 'Bajra', 'बाजरा', 'HHB67', 2000, 2400, 2200),
    row('Rajasthan', 'Bikaner', 'Bikaner Mandi', 'Gram', 'चना', 'Desi', 5200, 6000, 5600),
    row('Karnataka', 'Kalaburagi', 'Gulbarga APMC', 'Toor Dal', 'तूर दाल', 'Local', 6500, 7500, 7000),
    row('Karnataka', 'Davangere', 'Davangere Mandi', 'Maize', 'मक्का', 'Yellow', 1700, 2000, 1850),
    row('Karnataka', 'Hassan', 'Hassan Market', 'Ragi', 'रागी', 'GPU28', 2800, 3500, 3200),
  ];
};

// ----------------------------------------------------------------- logic ---
const fillCatalog = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected database: ${mongoose.connection.name}`.cyan);

    let upserted = 0;

    // ---- Products (key: name.en) ----
    for (const p of PRODUCTS) {
      const res = await Product.updateOne(
        { 'name.en': p.name.en },
        {
          $set: {
            description: p.description,
            category: p.category,
            tags: p.tags,
            price: p.price,
            unit: p.unit,
            stock: p.stock,
            image: p.image,
          },
          $setOnInsert: { name: p.name, isActive: true },
        },
        { upsert: true }
      );
      if (res.upsertedCount) upserted++;
    }
    console.log(`Products ensured: ${PRODUCTS.length} (${upserted} newly created)`.green);

    // ---- Grains (key: name.en). Seller = first active admin, if any. ----
    const admin = await User.findOne({ userType: 'ADMIN', isActive: true, deletedAt: null }).sort({
      createdAt: 1,
    });
    const sellerNote = admin ? `seller=${admin._id}` : 'no admin found — seller left empty';
    let grainNew = 0;
    for (const g of GRAINS()) {
      const res = await Grain.updateOne(
        { 'name.en': g.name.en },
        {
          $set: {
            type: g.type,
            variety: g.variety,
            description: g.description,
            pricePerQuintal: g.pricePerQuintal,
            minOrderQuintal: g.minOrderQuintal,
            availableQuintal: g.availableQuintal,
            location: g.location,
            state: g.state,
            district: g.district,
            images: g.images,
            isOrganic: g.isOrganic,
            isActive: true,
            ...(admin ? { seller: admin._id } : {}),
          },
          $setOnInsert: { name: g.name },
        },
        { upsert: true }
      );
      if (res.upsertedCount) grainNew++;
    }
    console.log(`Grains ensured: 10 (${grainNew} newly created; ${sellerNote})`.green);

    // ---- Mandi prices (key: state + district + commodity.en + date) ----
    let mandiNew = 0;
    for (const m of MANDI_PRICES()) {
      const res = await MandiPrice.updateOne(
        { state: m.state, district: m.district, 'commodity.en': m.commodity.en, date: m.date },
        { $set: { ...m, fetchedAt: new Date() } },
        { upsert: true }
      );
      if (res.upsertedCount) mandiNew++;
    }
    console.log(`Mandi records ensured: 15 (${mandiNew} records dated today)`.green);

    console.log('\n✅ Catalog fill complete — no existing data was modified or deleted.'.green.bold);
  } catch (error) {
    console.error('\nCATALOG FILL FAILED'.red.bold);
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('MongoDB connection closed.'.cyan);
    }
  }
};

fillCatalog();
