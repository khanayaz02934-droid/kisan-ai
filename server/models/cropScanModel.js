import mongoose from 'mongoose';

const bilingualArraySchema = {
  en: [{ type: String }],
  hi: [{ type: String }],
};

const cropScanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    imageUrl: { type: String, required: true },
    result: {
      cropName: { en: String, hi: String },
      disease: { en: String, hi: String },
      confidence: { type: Number, default: 0 },
      symptoms: bilingualArraySchema,
      treatment: bilingualArraySchema,
      prevention: bilingualArraySchema,
      medicineKeywords: [{ type: String }],
      isHealthy: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'NEEDS_REVIEW', 'FAILED'],
      default: 'COMPLETED',
    },
    reviewMessage: { en: String, hi: String },
    matchedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

const CropScan = mongoose.model('CropScan', cropScanSchema);
export default CropScan;
