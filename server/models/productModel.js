import mongoose from 'mongoose';

const bilingualSchema = {
  en: { type: String, required: true },
  hi: { type: String, required: true },
};

const productSchema = new mongoose.Schema(
  {
    name: bilingualSchema,
    description: {
      en: { type: String, default: '' },
      hi: { type: String, default: '' },
    },
    category: {
      type: String,
      enum: ['PESTICIDE', 'FUNGICIDE', 'FERTILIZER', 'SEED', 'BIO_PRODUCT'],
      required: true,
    },
    tags: [{ type: String, lowercase: true }],
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, default: '500ml' },
    stock: { type: Number, required: true, default: 0 },
    image: { type: String, default: '' },
    expireOn: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Text index for search
productSchema.index({ 'name.en': 'text', 'name.hi': 'text', tags: 'text' });

const Product = mongoose.model('Product', productSchema);
export default Product;
