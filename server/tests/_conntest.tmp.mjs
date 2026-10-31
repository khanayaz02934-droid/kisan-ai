import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);
console.error('CONNECTED, readyState =', mongoose.connection.readyState);

test('ping db', async () => {
  console.error('inside test, readyState =', mongoose.connection.readyState);
  const c = await mongoose.connection.db.command({ ping: 1 });
  assert.equal(c.ok, 1);
});
