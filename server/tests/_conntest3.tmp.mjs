import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import { deleteUser } from '../controllers/adminController.js';

console.error('PRE-CONNECT readyState =', mongoose.connection.readyState);
await mongoose.connect(process.env.MONGO_URI);
console.error('POST-CONNECT readyState =', mongoose.connection.readyState);

const unique = randomBytes(4).toString('hex');

test('create admin smoke', async () => {
  console.error('IN TEST readyState =', mongoose.connection.readyState);
  const admin = await User.create({ name: 'X Admin', email: `x-admin-${unique}@kisanai.com`, password: 'secret123', userType: 'ADMIN', isActive: true });
  assert.ok(admin._id);
  await admin.deleteOne();
  console.error('DONE, readyState =', mongoose.connection.readyState);
});
