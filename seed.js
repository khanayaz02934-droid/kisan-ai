import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import colors from 'colors';

import User from './server/models/userModel.js';
import Product from './server/models/productModel.js';
import Grain from './server/models/grainModel.js';
import MandiPrice from './server/models/mandiPriceModel.js';
import Cart from './server/models/cartModel.js';
import Order from './server/models/orderModel.js';
import CropScan from './server/models/cropScanModel.js';
import GrainOrder from './server/models/grainOrderModel.js';

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/kisan-ai';

const seedData = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is missing.');
    }

    await mongoose.connect(MONGO_URI);

    console.log('MongoDB Connected'.cyan.bold);
    console.log(`Connected database: ${mongoose.connection.name}`.cyan);

    // ================= DELETE OLD DATA =================

    console.log('\nClearing existing collections...'.yellow);

    const deleteResults = await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Grain.deleteMany({}),
      MandiPrice.deleteMany({}),
      Cart.deleteMany({}),
      Order.deleteMany({}),
      CropScan.deleteMany({}),
      GrainOrder.deleteMany({}),
    ]);

    const collectionNames = [
      'Users',
      'Products',
      'Grains',
      'MandiPrices',
      'Carts',
      'Orders',
      'CropScans',
      'GrainOrders',
    ];

    deleteResults.forEach((result, index) => {
      console.log(
        `${collectionNames[index]} deleted: ${result.deletedCount}`.yellow
      );
    });

    console.log('All old data deleted successfully'.green.bold);

    // ================= USERS =================

    console.log('\nSeeding users...'.yellow);

    const hashedPassword = await bcrypt.hash('password123', 10);

    const users = await User.insertMany([
      {
        name: 'Ramesh Kumar',
        email: 'ramesh@kisanai.com',
        password: hashedPassword,
        userType: 'USER',
        phone: '9876543210',
        state: 'Punjab',
        district: 'Ludhiana',
        village: 'Sahnewal',
        preferredLang: 'hi',
        isActive: true,
      },
      {
        name: 'Sunita Devi',
        email: 'sunita@kisanai.com',
        password: hashedPassword,
        userType: 'USER',
        phone: '9876543211',
        state: 'Uttar Pradesh',
        district: 'Agra',
        village: 'Shamshabad',
        preferredLang: 'hi',
        isActive: true,
      },
      {
        name: 'Mohan Singh',
        email: 'mohan@kisanai.com',
        password: hashedPassword,
        userType: 'USER',
        phone: '9876543212',
        state: 'Maharashtra',
        district: 'Nashik',
        village: 'Dindori',
        preferredLang: 'en',
        isActive: true,
      },
      {
        name: 'Admin Kisan',
        email: 'admin@kisanai.com',
        // insertMany below bypasses the pre-save hash hook, so the password
        // MUST be pre-hashed here. (A raw string would be stored in plaintext
        // and admin login would never work on a fresh database.)
        password: hashedPassword,
        userType: 'ADMIN',
        phone: '9000000000',
        state: 'Delhi',
        district: 'New Delhi',
        preferredLang: 'en',
        isActive: true,
      },
     
    ]);

    console.log(`${users.length} users created`.green);

    // ================= PRODUCTS =================

    console.log('\nSeeding products...'.yellow);

    const products = await Product.insertMany([
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
        image:
          'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
      },
      {
        name: {
          en: 'Trichoderma Bio-Fungicide',
          hi: 'ट्राइकोडर्मा जैव-फफूंदनाशक',
        },
        description: {
          en: 'Bio-fungicide for soil-borne diseases.',
          hi: 'मिट्टी से होने वाली बीमारियों के लिए जैविक फफूंदनाशक।',
        },
        category: 'BIO_PRODUCT',
        tags: ['trichoderma', 'fungicide', 'root rot'],
        price: 280,
        unit: '1kg',
        stock: 200,
        image:
          'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400',
      },
      {
        name: {
          en: 'Copper Fungicide Spray',
          hi: 'कॉपर फफूंदनाशक स्प्रे',
        },
        description: {
          en: 'Copper-based fungicide for blight and mildew.',
          hi: 'ब्लाइट और फफूंदी के लिए कॉपर आधारित फफूंदनाशक।',
        },
        category: 'FUNGICIDE',
        tags: ['copper', 'fungicide', 'blight'],
        price: 450,
        unit: '250g',
        stock: 120,
        image:
          'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400',
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
        image:
          'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
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
        image:
          'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400',
      },
      {
        name: {
          en: 'Imidacloprid Insecticide',
          hi: 'इमिडाक्लोप्रिड कीटनाशक',
        },
        description: {
          en: 'Systemic insecticide for sucking pests.',
          hi: 'चूसने वाले कीटों के लिए कीटनाशक।',
        },
        category: 'PESTICIDE',
        tags: ['imidacloprid', 'insecticide', 'aphids'],
        price: 580,
        unit: '100ml',
        stock: 90,
        image:
          'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400',
      },
      {
        name: {
          en: 'Pseudomonas Bio-Control',
          hi: 'स्यूडोमोनास जैव-नियंत्रण',
        },
        description: {
          en: 'Bioagent for controlling bacterial and fungal diseases.',
          hi: 'जीवाणु और फफूंद रोगों के नियंत्रण के लिए जैविक उत्पाद।',
        },
        category: 'BIO_PRODUCT',
        tags: ['pseudomonas', 'bio control'],
        price: 260,
        unit: '1kg',
        stock: 160,
        image:
          'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
      },
      {
        name: {
          en: 'Vermicompost Organic',
          hi: 'वर्मीकम्पोस्ट जैविक',
        },
        description: {
          en: 'Organic compost for improving soil structure.',
          hi: 'मिट्टी की गुणवत्ता सुधारने के लिए जैविक खाद।',
        },
        category: 'FERTILIZER',
        tags: ['vermicompost', 'organic', 'compost'],
        price: 180,
        unit: '5kg',
        stock: 400,
        image:
          'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400',
      },
      {
        name: {
          en: 'Hybrid Tomato Seeds F1',
          hi: 'हाइब्रिड टमाटर बीज F1',
        },
        description: {
          en: 'High-yield hybrid tomato seeds.',
          hi: 'अधिक उत्पादन देने वाले हाइब्रिड टमाटर के बीज।',
        },
        category: 'SEED',
        tags: ['tomato', 'hybrid seeds'],
        price: 850,
        unit: '10g',
        stock: 75,
        image:
          'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400',
      },
      {
        name: {
          en: 'Sulfur Dust Fungicide',
          hi: 'सल्फर डस्ट फफूंदनाशक',
        },
        description: {
          en: 'Wettable sulfur for powdery mildew and rust control.',
          hi: 'पाउडरी फफूंदी और जंग नियंत्रण के लिए सल्फर।',
        },
        category: 'FUNGICIDE',
        tags: ['sulfur', 'fungicide', 'rust'],
        price: 195,
        unit: '1kg',
        stock: 220,
        image:
          'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=400',
      },
      {
        name: {
          en: 'Beauveria bassiana Bio-Pesticide',
          hi: 'ब्यूवेरिया बैसियाना जैव-कीटनाशक',
        },
        description: {
          en: 'Organic bio-pesticide for soil pests.',
          hi: 'मिट्टी के कीटों के लिए जैविक कीटनाशक।',
        },
        category: 'BIO_PRODUCT',
        tags: ['beauveria', 'bio pesticide'],
        price: 310,
        unit: '500g',
        stock: 140,
        image:
          'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
      },
      {
        name: {
          en: 'DAP Diammonium Phosphate',
          hi: 'DAP डाई अमोनियम फॉस्फेट',
        },
        description: {
          en: 'High phosphorus starter fertilizer.',
          hi: 'जड़ विकास के लिए फॉस्फोरस युक्त उर्वरक।',
        },
        category: 'FERTILIZER',
        tags: ['dap', 'fertilizer', 'phosphorus'],
        price: 1350,
        unit: '50kg bag',
        stock: 60,
        image:
          'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400',
      },
    ]);

    console.log(`${products.length} products created`.green);

    // ================= GRAINS =================

    console.log('\nSeeding grains...'.yellow);

    const adminUser = users.find((u) => u.userType === 'ADMIN');

    if (!adminUser) {
      throw new Error('Admin user not found.');
    }

    const grains = await Grain.insertMany([
      {
        name: {
          en: 'Premium Basmati Rice',
          hi: 'प्रीमियम बासमती चावल',
        },
        type: 'RICE',
        variety: '1121 Basmati',
        description: {
          en: 'Long-grain aromatic basmati rice.',
          hi: 'लंबे दाने वाला सुगंधित बासमती चावल।',
        },
        pricePerQuintal: 6500,
        minOrderQuintal: 2,
        availableQuintal: 500,
        location: 'Amritsar, Punjab',
        state: 'Punjab',
        district: 'Amritsar',
        images: [
          'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=400',
        ],
        isOrganic: false,
        seller: adminUser._id,
      },
      {
        name: {
          en: 'Organic Wheat Sharbati',
          hi: 'जैविक गेहूं शरबती',
        },
        type: 'WHEAT',
        variety: 'Sharbati',
        description: {
          en: 'Organic Sharbati wheat from Madhya Pradesh.',
          hi: 'मध्य प्रदेश का जैविक शरबती गेहूं।',
        },
        pricePerQuintal: 2800,
        minOrderQuintal: 5,
        availableQuintal: 800,
        location: 'Sehore, Madhya Pradesh',
        state: 'Madhya Pradesh',
        district: 'Sehore',
        images: [
          'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400',
        ],
        isOrganic: true,
        seller: adminUser._id,
      },
      {
        name: {
          en: 'Yellow Maize (Corn)',
          hi: 'पीली मक्का',
        },
        type: 'MAIZE',
        variety: 'Hybrid Yellow',
        description: {
          en: 'Fresh yellow maize.',
          hi: 'ताजी पीली मक्का।',
        },
        pricePerQuintal: 1850,
        minOrderQuintal: 10,
        availableQuintal: 2000,
        location: 'Davangere, Karnataka',
        state: 'Karnataka',
        district: 'Davangere',
        images: [
          'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400',
        ],
        isOrganic: false,
        seller: adminUser._id,
      },
      {
        name: {
          en: 'Toor Dal (Arhar)',
          hi: 'तूर दाल (अरहर)',
        },
        type: 'PULSES',
        variety: 'Local Variety',
        description: {
          en: 'Fresh red gram lentils.',
          hi: 'ताजी अरहर दाल।',
        },
        pricePerQuintal: 7200,
        minOrderQuintal: 1,
        availableQuintal: 300,
        location: 'Gulbarga, Karnataka',
        state: 'Karnataka',
        district: 'Kalaburagi',
        images: [
          'https://images.unsplash.com/photo-1584824486516-0555a07fc511?w=400',
        ],
        isOrganic: false,
        seller: adminUser._id,
      },
      {
        name: {
          en: 'Pearl Millet (Bajra)',
          hi: 'बाजरा',
        },
        type: 'MILLETS',
        variety: 'HHB 67',
        description: {
          en: 'High-yield bajra variety.',
          hi: 'अधिक उत्पादन देने वाली बाजरे की किस्म।',
        },
        pricePerQuintal: 2200,
        minOrderQuintal: 5,
        availableQuintal: 1200,
        location: 'Barmer, Rajasthan',
        state: 'Rajasthan',
        district: 'Barmer',
        images: [
          'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400',
        ],
        isOrganic: false,
        seller: adminUser._id,
      },
      {
        name: {
          en: 'Organic Mustard Seeds',
          hi: 'जैविक सरसों के बीज',
        },
        type: 'OILSEEDS',
        variety: 'Pusa Bold',
        description: {
          en: 'Organic mustard seeds.',
          hi: 'जैविक सरसों के बीज।',
        },
        pricePerQuintal: 5500,
        minOrderQuintal: 2,
        availableQuintal: 400,
        location: 'Alwar, Rajasthan',
        state: 'Rajasthan',
        district: 'Alwar',
        images: [
          'https://images.unsplash.com/photo-1584824486516-0555a07fc511?w=400',
        ],
        isOrganic: true,
        seller: adminUser._id,
      },
      {
        name: {
          en: 'Soybean',
          hi: 'सोयाबीन',
        },
        type: 'OILSEEDS',
        variety: 'JS 335',
        description: {
          en: 'High-protein soybean variety.',
          hi: 'उच्च प्रोटीन वाली सोयाबीन किस्म।',
        },
        pricePerQuintal: 4200,
        minOrderQuintal: 5,
        availableQuintal: 600,
        location: 'Nagpur, Maharashtra',
        state: 'Maharashtra',
        district: 'Nagpur',
        images: [
          'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400',
        ],
        isOrganic: false,
        seller: adminUser._id,
      },
      {
        name: {
          en: 'Green Gram (Moong Dal)',
          hi: 'हरी मूंग दाल',
        },
        type: 'PULSES',
        variety: 'Pusa Vishal',
        description: {
          en: 'Fresh green gram.',
          hi: 'ताजी हरी मूंग।',
        },
        pricePerQuintal: 7800,
        minOrderQuintal: 1,
        availableQuintal: 250,
        location: 'Jaipur, Rajasthan',
        state: 'Rajasthan',
        district: 'Jaipur',
        images: [
          'https://images.unsplash.com/photo-1584824486516-0555a07fc511?w=400',
        ],
        isOrganic: false,
        seller: adminUser._id,
      },
      {
        name: {
          en: 'Finger Millet (Ragi)',
          hi: 'रागी',
        },
        type: 'MILLETS',
        variety: 'GPU 28',
        description: {
          en: 'Calcium-rich ragi.',
          hi: 'कैल्शियम से भरपूर रागी।',
        },
        pricePerQuintal: 3200,
        minOrderQuintal: 2,
        availableQuintal: 350,
        location: 'Hassan, Karnataka',
        state: 'Karnataka',
        district: 'Hassan',
        images: [
          'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400',
        ],
        isOrganic: true,
        seller: adminUser._id,
      },
      {
        name: {
          en: 'Chana (Chickpea)',
          hi: 'चना',
        },
        type: 'PULSES',
        variety: 'Desi Chana',
        description: {
          en: 'Desi chickpea from Madhya Pradesh.',
          hi: 'मध्य प्रदेश का देसी चना।',
        },
        pricePerQuintal: 5600,
        minOrderQuintal: 2,
        availableQuintal: 700,
        location: 'Vidisha, Madhya Pradesh',
        state: 'Madhya Pradesh',
        district: 'Vidisha',
        images: [
          'https://images.unsplash.com/photo-1584824486516-0555a07fc511?w=400',
        ],
        isOrganic: false,
        seller: adminUser._id,
      },
    ]);

    console.log(`${grains.length} grains created`.green);

    // ================= MANDI PRICES =================

    console.log('\nSeeding mandi prices...'.yellow);

    const today = new Date().toISOString().split('T')[0];

    const mandiPrices = await MandiPrice.insertMany([
      // Punjab
      {
        state: 'Punjab',
        district: 'Ludhiana',
        market: 'Ludhiana Mandi',
        commodity: { en: 'Wheat', hi: 'गेहूं' },
        variety: 'HD2967',
        minPrice: 2100,
        maxPrice: 2250,
        modalPrice: 2175,
        date: today,
        source: 'SEED',
      },
      {
        state: 'Punjab',
        district: 'Amritsar',
        market: 'Amritsar Grain Market',
        commodity: { en: 'Rice (Basmati)', hi: 'बासमती चावल' },
        variety: '1121',
        minPrice: 5800,
        maxPrice: 7000,
        modalPrice: 6200,
        date: today,
        source: 'SEED',
      },
      {
        state: 'Punjab',
        district: 'Patiala',
        market: 'Patiala Mandi',
        commodity: { en: 'Maize', hi: 'मक्का' },
        variety: 'Yellow',
        minPrice: 1600,
        maxPrice: 1950,
        modalPrice: 1780,
        date: today,
        source: 'SEED',
      },

      // Uttar Pradesh
      {
        state: 'Uttar Pradesh',
        district: 'Agra',
        market: 'Agra APMC',
        commodity: { en: 'Wheat', hi: 'गेहूं' },
        variety: 'Lok1',
        minPrice: 2050,
        maxPrice: 2200,
        modalPrice: 2125,
        date: today,
        source: 'SEED',
      },
      {
        state: 'Uttar Pradesh',
        district: 'Lucknow',
        market: 'Lucknow Mandi',
        commodity: { en: 'Potato', hi: 'आलू' },
        variety: 'Kufri Jyoti',
        minPrice: 1200,
        maxPrice: 1800,
        modalPrice: 1500,
        date: today,
        source: 'SEED',
      },
      {
        state: 'Uttar Pradesh',
        district: 'Varanasi',
        market: 'Varanasi Agri Market',
        commodity: { en: 'Onion', hi: 'प्याज' },
        variety: 'Local',
        minPrice: 800,
        maxPrice: 1500,
        modalPrice: 1200,
        date: today,
        source: 'SEED',
      },

      // Maharashtra
      {
        state: 'Maharashtra',
        district: 'Nashik',
        market: 'Lasalgaon Mandi',
        commodity: { en: 'Onion', hi: 'प्याज' },
        variety: 'Red Medium',
        minPrice: 900,
        maxPrice: 1800,
        modalPrice: 1350,
        date: today,
        source: 'SEED',
      },
      {
        state: 'Maharashtra',
        district: 'Nagpur',
        market: 'Nagpur APMC',
        commodity: { en: 'Soybean', hi: 'सोयाबीन' },
        variety: 'JS335',
        minPrice: 3800,
        maxPrice: 4500,
        modalPrice: 4150,
        date: today,
        source: 'SEED',
      },
      {
        state: 'Maharashtra',
        district: 'Pune',
        market: 'Pune Mandi',
        commodity: { en: 'Tomato', hi: 'टमाटर' },
        variety: 'Hybrid',
        minPrice: 1500,
        maxPrice: 3000,
        modalPrice: 2200,
        date: today,
        source: 'SEED',
      },

      // Rajasthan
      {
        state: 'Rajasthan',
        district: 'Jaipur',
        market: 'Jaipur Mandi',
        commodity: { en: 'Mustard', hi: 'सरसों' },
        variety: 'Pusa Bold',
        minPrice: 5000,
        maxPrice: 5800,
        modalPrice: 5400,
        date: today,
        source: 'SEED',
      },
      {
        state: 'Rajasthan',
        district: 'Barmer',
        market: 'Barmer Grain Market',
        commodity: { en: 'Bajra', hi: 'बाजरा' },
        variety: 'HHB67',
        minPrice: 2000,
        maxPrice: 2400,
        modalPrice: 2200,
        date: today,
        source: 'SEED',
      },
      {
        state: 'Rajasthan',
        district: 'Bikaner',
        market: 'Bikaner Mandi',
        commodity: { en: 'Gram', hi: 'चना' },
        variety: 'Desi',
        minPrice: 5200,
        maxPrice: 6000,
        modalPrice: 5600,
        date: today,
        source: 'SEED',
      },

      // Karnataka
      {
        state: 'Karnataka',
        district: 'Kalaburagi',
        market: 'Gulbarga APMC',
        commodity: { en: 'Toor Dal', hi: 'तूर दाल' },
        variety: 'Local',
        minPrice: 6500,
        maxPrice: 7500,
        modalPrice: 7000,
        date: today,
        source: 'SEED',
      },
      {
        state: 'Karnataka',
        district: 'Davangere',
        market: 'Davangere Mandi',
        commodity: { en: 'Maize', hi: 'मक्का' },
        variety: 'Yellow',
        minPrice: 1700,
        maxPrice: 2000,
        modalPrice: 1850,
        date: today,
        source: 'SEED',
      },
      {
        state: 'Karnataka',
        district: 'Hassan',
        market: 'Hassan Market',
        commodity: { en: 'Ragi', hi: 'रागी' },
        variety: 'GPU28',
        minPrice: 2800,
        maxPrice: 3500,
        modalPrice: 3200,
        date: today,
        source: 'SEED',
      },
    ]);

    console.log(`${mandiPrices.length} mandi records created`.green);

    // ================= SUMMARY =================

    console.log('\n========================================'.green);
    console.log('KISAN AI DATABASE SEEDED SUCCESSFULLY'.green.bold);
    console.log('========================================'.green);

    console.log(`Users: ${users.length}`);
    console.log(`Products: ${products.length}`);
    console.log(`Grains: ${grains.length}`);
    console.log(`Mandi Prices: ${mandiPrices.length}`);

    console.log('\nLOGIN DETAILS'.yellow.bold);
    console.log('Password: password123');
    console.log('Farmer: ramesh@kisanai.com');
    console.log('Farmer: sunita@kisanai.com');
    console.log('Farmer: mohan@kisanai.com');
    console.log('Admin: admin@kisanai.com');

  } catch (error) {
    console.error('\nDATABASE SEEDING FAILED'.red.bold);
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('MongoDB connection closed.'.cyan);
    }
  }
};

seedData();