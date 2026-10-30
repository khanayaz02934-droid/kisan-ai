import mongoose from 'mongoose';

const grainSchema = new mongoose.Schema(
  {
    name: {
      en: { type: String, required: true },
      hi: { type: String, required: true },
    },
    type: {
      type: String,
      enum: ['WHEAT', 'RICE', 'MAIZE', 'PULSES', 'MILLETS', 'OILSEEDS', 'BARLEY', 'SORGHUM', 'OTHER'],
      required: true,
    },
    variety: { type: String, default: '' },
    description: {
      en: { type: String, default: '' },
      hi: { type: String, default: '' },
    },
    pricePerQuintal: { type: Number, required: true },
    minOrderQuintal: { type: Number, required: true, default: 1 },
    availableQuintal: { type: Number, required: true, default: 0 },
    location: { type: String, required: true },
    state: { type: String, default: '' },
    district: { type: String, default: '' },
    images: [{ type: String }],
    isOrganic: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const Grain = mongoose.model('Grain', grainSchema);
export default Grain;
