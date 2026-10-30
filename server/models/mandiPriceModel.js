import mongoose from 'mongoose';

const mandiPriceSchema = new mongoose.Schema(
  {
    state: { type: String, required: true },
    district: { type: String, required: true },
    market: { type: String, default: '' },
    commodity: {
      en: { type: String, required: true },
      hi: { type: String, required: true },
    },
    variety: { type: String, default: '' },
    minPrice: { type: Number, default: 0 },
    maxPrice: { type: Number, default: 0 },
    modalPrice: { type: Number, default: 0 },
    date: { type: String, default: '' },
    fetchedAt: { type: Date, default: Date.now },
    source: { type: String, enum: ['API', 'MANUAL', 'SEED'], default: 'API' },
  },
  { timestamps: true }
);

// Compound index for fast lookup
mandiPriceSchema.index({ state: 1, district: 1, 'commodity.en': 1, date: 1 });

const MandiPrice = mongoose.model('MandiPrice', mandiPriceSchema);
export default MandiPrice;
