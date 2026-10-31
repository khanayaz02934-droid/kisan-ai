import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    userType: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
    phone: { type: String, default: '' },
    state: { type: String, default: '' },
    district: { type: String, default: '' },
    village: { type: String, default: '' },
    preferredLang: { type: String, enum: ['en', 'hi'], default: 'en' },
    isActive: { type: Boolean, default: true },
    // Soft-delete support. When set, the account is anonymised but its
    // referenced records (orders, carts, scans) stay intact.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Never return password
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);
export default User;
