/**
 * Unit tests for the admin user-deletion guards (self-deletion protection and
 * last-remaining-admin protection). These run WITHOUT the HTTP server: the
 * controller functions are called directly against the test database.
 *
 * Note: the last-admin guard is intentionally unreachable over HTTP — the
 * auth middleware only lets ACTIVE admins through, so the pool of active
 * admins can never reach zero via this endpoint. Testing it here keeps the
 * guard honest as defence-in-depth.
 *
 * Requires a reachable MongoDB (the same MONGO_URI the server uses).
 */
import 'dotenv/config';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import User from '../models/userModel.js';
import { deleteUser } from '../controllers/adminController.js';

if (!process.env.MONGO_URI) {
  console.error('adminUserGuards: MONGO_URI is not set — skipping (tests need the database).');
  process.exit(0);
}

await mongoose.connect(process.env.MONGO_URI);

const unique = randomBytes(4).toString('hex');

/** Minimal Express response stub that records behaviour. */
const mockRes = () => {
  const state = { status: 0, body: null };
  return {
    state,
    status(code) {
      state.status = code;
      return this;
    },
    json(body) {
      state.body = body;
      return this;
    },
  };
};

test('a user cannot delete their own account', async () => {
  const admin = await User.create({
    name: 'Self Admin',
    email: `self-admin-${unique}@kisanai.com`,
    password: 'secret123',
    userType: 'ADMIN',
    isActive: true,
  });

  const res = mockRes();
  let caught;
  await deleteUser(
    { params: { id: String(admin._id) }, user: admin },
    res,
    (e) => {
      caught = e;
    }
  );

  assert.equal(res.state.status, 400);
  assert.match(caught?.message || '', /own account/i);

  // Nothing was mutated
  const after = await User.findById(admin._id).lean();
  assert.equal(after.deletedAt, null);

  await admin.deleteOne();
});

test('the last remaining active admin cannot be deleted', async () => {
  // The shared developer database usually contains a seeded active admin, so
  // the "solo admin" state is created by temporarily deactivating every other
  // active admin — and restoring them in finally, whatever the outcome.
  const othersSnapshot = await User.find({
    userType: 'ADMIN',
    isActive: true,
    deletedAt: null,
  }).select('_id isActive');
  const otherIds = othersSnapshot.map((u) => u._id);

  await User.updateMany({ _id: { $in: otherIds } }, { isActive: false });

  let target;
  let requester;
  try {
    // Target: the ONLY active admin in this scenario.
    target = await User.create({
      name: 'Solo Admin',
      email: `solo-admin-${unique}@kisanai.com`,
      password: 'secret123',
      userType: 'ADMIN',
      isActive: true,
    });
    // Requester: an admin whose isActive was flipped off earlier in their admin
    // lifecycle (protect would block an inactive admin over HTTP — direct calls
    // bypass middleware on purpose to exercise the inner guard).
    requester = await User.create({
      name: 'Disabled Admin',
      email: `disabled-admin-${unique}@kisanai.com`,
      password: 'secret123',
      userType: 'ADMIN',
      isActive: false,
    });

    const res = mockRes();
    let caught;
    await deleteUser(
      { params: { id: String(target._id) }, user: requester },
      res,
      (e) => {
        caught = e;
      }
    );

    assert.equal(res.state.status, 409);
    assert.match(caught?.message || '', /last remaining admin/i);

    // No mutation
    const after = await User.findById(target._id).lean();
    assert.equal(after.deletedAt, null);
  } finally {
    // Restore everything: drop the two test accounts and re-activate the
    // real admins that were deactivated for this scenario.
    await Promise.all([
      target?.deleteOne(),
      requester?.deleteOne(),
      User.updateMany({ _id: { $in: otherIds } }, { isActive: true }),
    ]);
  }
});

test('a non-last admin is soft-deleted and their email is anonymised (history preserved)', async () => {
  const target = await User.create({
    name: 'Temp Second Admin',
    email: `second-admin-${unique}@kisanai.com`,
    password: 'secret123',
    userType: 'ADMIN',
    isActive: true,
  });
  const requester = await User.create({
    name: 'Main Admin Actor',
    email: `main-admin-actor-${unique}@kisanai.com`,
    password: 'secret123',
    userType: 'ADMIN',
    isActive: true,
  });

  const res = mockRes();
  let caught;
  await deleteUser(
    { params: { id: String(target._id) }, user: requester },
    res,
    (e) => {
      caught = e;
    }
  );

  assert.equal(caught, undefined);
  assert.equal(res.state.status, 200);
  assert.equal(res.state.body.success, true);

  const after = await User.findById(target._id).lean();
  assert.ok(after.deletedAt instanceof Date);
  assert.equal(after.isActive, false);
  assert.equal(after.name, 'Deleted User');
  assert.notEqual(after.email, `second-admin-${unique}@kisanai.com`);
  assert.match(after.email, /^deleted-/);

  await Promise.all([target.deleteOne(), requester.deleteOne()]);
});

test('invalid ids are rejected as 400', async () => {
  const requester = await User.create({
    name: 'Invalid Id Admin',
    email: `invalid-id-admin-${unique}@kisanai.com`,
    password: 'secret123',
    userType: 'ADMIN',
    isActive: true,
  });

  const res = mockRes();
  let caught;
  await deleteUser({ params: { id: 'not-a-valid-id' }, user: requester }, res, (e) => {
    caught = e;
  });

  assert.equal(res.state.status, 400);
  assert.match(caught?.message || '', /invalid user id/i);

  await requester.deleteOne();
});

test('unknown ids are rejected as 404', async () => {
  const requester = await User.create({
    name: 'Unknown Id Admin',
    email: `unknown-id-admin-${unique}@kisanai.com`,
    password: 'secret123',
    userType: 'ADMIN',
    isActive: true,
  });

  const res = mockRes();
  let caught;
  await deleteUser(
    { params: { id: `${'7'.repeat(24)}` }, user: requester },
    res,
    (e) => {
      caught = e;
    }
  );

  assert.equal(res.state.status, 404);
  assert.match(caught?.message || '', /not found/i);

  await requester.deleteOne();
});

// after() runs once ALL tests have completed (unlike top-level await, which
// would close the connection before the queued tests ever execute).
after(() => mongoose.disconnect());
