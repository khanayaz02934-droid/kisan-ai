import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

await mongoose.connect(process.env.MONGO_URI);
console.error('CONNECTED: readyState =', mongoose.connection.readyState);
const mod = await import('../controllers/adminController.js');
console.error('AFTER CONTROLLER IMPORT: readyState =', mongoose.connection.readyState);

test('deleteUser guard smoke', async () => {
  console.error('IN TEST: readyState =', mongoose.connection.readyState);
  const res = { _code: 0, status(c) { this._code = c; return this; }, json() { return this; } };
  let caught;
  await mod.deleteUser({ params: { id: 'zzz' }, user: { _id: 'u1' } }, res, (e) => { caught = e; });
  assert.equal(res._code, 400);
  assert.match(caught.message, /invalid user id/i);
});
