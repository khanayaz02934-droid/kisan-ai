import mongoose from 'mongoose';

const grainOrderAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    village: { type: String, default: '' },
    district: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);

const grainOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    grain: { type: mongoose.Schema.Types.ObjectId, ref: 'Grain', required: true },
    grainName: { en: String, hi: String },
    quantityQuintal: { type: Number, required: true, min: 0.1 },
    pricePerQuintal: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    address: grainOrderAddressSchema,
    status: {
      type: String,
      enum: ['PLACED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'],
      default: 'PLACED',
    },
    paymentMethod: { type: String, default: 'COD' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

const GrainOrder = mongoose.model('GrainOrder', grainOrderSchema);
export default GrainOrder;
