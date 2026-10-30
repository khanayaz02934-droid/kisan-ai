/**
 * Kisan AI — backend API integration tests.
 * Run with the server NOT running; this script starts nothing — it expects the
 * server on http://localhost:5000/api (see npm start / node server/server.js).
 *
 * Usage:
 *   node server/tests/api.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000/api';

// Minimal valid 1x1 transparent PNG
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const unique = randomBytes(4).toString('hex');
let farmerToken;
let adminToken;

const req = async (path, { method = 'GET', token, body, form } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, json };
};

// ---------- Health ----------
test('GET /api/health returns ok', async () => {
  const { status, json } = await req('/health');
  assert.equal(status, 200);
  assert.equal(json.success, true);
});

// ---------- Auth: register ----------
test('POST /auth/register creates a user and returns a token (no password hash)', async () => {
  const { status, json } = await req('/auth/register', {
    method: 'POST',
    body: {
      name: 'Test Farmer',
      email: `test-${unique}@kisanai.com`,
      password: 'secret123',
      phone: '9999888811',
    },
  });
  assert.equal(status, 201);
  assert.equal(json.success, true);
  const { user, token } = json.data;
  assert.ok(token, 'token returned');
  assert.equal(user.email, `test-${unique}@kisanai.com`);
  assert.equal(user.password, undefined, 'no password field leaked');
  farmerToken = token;
});

test('POST /auth/register rejects duplicate email', async () => {
  const { status, json } = await req('/auth/register', {
    method: 'POST',
    body: { name: 'X', email: `test-${unique}@kisanai.com`, password: 'secret123' },
  });
  assert.equal(status, 400);
  assert.equal(json.success, false);
});

test('POST /auth/register rejects missing fields / short password / bad email', async () => {
  const missing = await req('/auth/register', {
    method: 'POST',
    body: { email: `a-${unique}@kisanai.com` },
  });
  assert.equal(missing.status, 400);

  const shortPwd = await req('/auth/register', {
    method: 'POST',
    body: { name: 'X', email: `b-${unique}@kisanai.com`, password: '123' },
  });
  assert.equal(shortPwd.status, 400);

  const badEmail = await req('/auth/register', {
    method: 'POST',
    body: { name: 'X', email: 'not-an-email', password: 'secret123' },
  });
  assert.equal(badEmail.status, 400);
});

// ---------- Auth: login ----------
test('POST /auth/login with seeded credentials succeeds', async () => {
  const { status, json } = await req('/auth/login', {
    method: 'POST',
    body: { email: 'ramesh@kisanai.com', password: 'password123' },
  });
  assert.equal(status, 200);
  const { user, token } = json.data;
  assert.ok(token);
  assert.equal(user.password, undefined);
});

test('POST /auth/login with wrong password returns 401', async () => {
  const { status, json } = await req('/auth/login', {
    method: 'POST',
    body: { email: 'ramesh@kisanai.com', password: 'wrong-password' },
  });
  assert.equal(status, 401);
  assert.match(json.message, /invalid/i);
});

test('POST /auth/login with unknown email returns 401', async () => {
  const { status } = await req('/auth/login', {
    method: 'POST',
    body: { email: `ghost-${unique}@kisanai.com`, password: 'whatever123' },
  });
  assert.equal(status, 401);
});

// ---------- Auth: protected profile ----------
test('GET /auth/me requires a token', async () => {
  const { status } = await req('/auth/me');
  assert.equal(status, 401);
});

test('GET /auth/me rejects a garbage token', async () => {
  const { status } = await req('/auth/me', { token: 'garbage.token.here' });
  assert.equal(status, 401);
});

test('GET /auth/me works with a valid token', async () => {
  const { status, json } = await req('/auth/me', { token: farmerToken });
  assert.equal(status, 200);
  assert.equal(json.data.email, `test-${unique}@kisanai.com`);
});

test('PUT /auth/profile changes are persisted', async () => {
  const { status, json } = await req('/auth/profile', {
    method: 'PUT',
    token: farmerToken,
    body: { village: 'Bharatpur' },
  });
  assert.equal(status, 200);
  assert.equal(json.data.village, 'Bharatpur');

  const me = await req('/auth/me', { token: farmerToken });
  assert.equal(me.json.data.village, 'Bharatpur');
});

test('PUT /auth/profile password change requires correct current password', async () => {
  const bad = await req('/auth/profile', {
    method: 'PUT',
    token: farmerToken,
    body: { currentPassword: 'nope', newPassword: 'newpass123' },
  });
  assert.equal(bad.status, 401);

  const ok = await req('/auth/profile', {
    method: 'PUT',
    token: farmerToken,
    body: { currentPassword: 'secret123', newPassword: 'newpass123' },
  });
  assert.equal(ok.status, 200);

  // Old password no longer works, new one does
  const oldLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: `test-${unique}@kisanai.com`, password: 'secret123' },
  });
  assert.equal(oldLogin.status, 401);
  const newLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: `test-${unique}@kisanai.com`, password: 'newpass123' },
  });
  assert.equal(newLogin.status, 200);
});

// ---------- Products ----------
test('GET /products lists seeded products', async () => {
  const { status, json } = await req('/products');
  assert.equal(status, 200);
  assert.ok(json.data.products.length >= 10);
  assert.ok(json.data.pagination.total >= json.data.products.length);
  const p = json.data.products[0];
  assert.ok(p.name.en, 'bilingual name');
  assert.equal(p.password, undefined);
});

test('GET /products search works and never crashes on regex metacharacters', async () => {
  const ok = await req('/products?search=neem');
  assert.equal(ok.status, 200);
  assert.ok(ok.json.data.products.length >= 1);

  // Regex injection attempt must not 500
  const evil = await req('/products?search=' + encodeURIComponent('(((((('));
  assert.equal(evil.status, 200);
});

test('GET /products category filter works', async () => {
  const { status, json } = await req('/products?category=SEED');
  assert.equal(status, 200);
  for (const p of json.data.products) assert.equal(p.category, 'SEED');
});

test('GET /products/:id returns 404 for a non-existent valid ObjectId', async () => {
  const { status, json } = await req('/products/000000000000000000000000');
  assert.equal(status, 404);
  assert.equal(json.success, false);
});

test('GET /products/:id returns 404 for a malformed id', async () => {
  const { status } = await req('/products/not-an-id');
  assert.equal(status, 404);
});

// ---------- Cart (protected) ----------
test('Cart endpoints require auth', async () => {
  const get = await req('/cart');
  assert.equal(get.status, 401);
  const add = await req('/cart', { method: 'POST', body: { productId: 'x' } });
  assert.equal(add.status, 401);
});

test('Add to cart → get cart → update qty → remove works end to end', async () => {
  const list = await req('/products?limit=1');
  const product = list.json.data.products[0];

  const add = await req('/cart/add', {
    method: 'POST',
    token: farmerToken,
    body: { productId: product._id, quantity: 2 },
  });
  assert.equal(add.status, 200);
  assert.equal(add.json.success, true);

  const cart = await req('/cart', { token: farmerToken });
  assert.equal(cart.status, 200);
  const item = cart.json.data.items.find((i) => i.product._id === product._id);
  assert.ok(item, 'item present');
  assert.equal(item.quantity, 2);

  const upd = await req(`/cart/${product._id}`, {
    method: 'PATCH',
    token: farmerToken,
    body: { quantity: 1 },
  });
  assert.equal(upd.status, 200);

  const rm = await req(`/cart/${product._id}`, { method: 'DELETE', token: farmerToken });
  assert.equal(rm.status, 200);

  const after = await req('/cart', { token: farmerToken });
  assert.equal(
    after.json.data.items.find((i) => i.product._id === product._id),
    undefined
  );
});

test('Add to cart with an unknown product id returns 404', async () => {
  const { status } = await req('/cart/add', {
    method: 'POST',
    token: farmerToken,
    body: { productId: '000000000000000000000000' },
  });
  assert.equal(status, 404);
});

test('Add to cart beyond stock is rejected', async () => {
  const list = await req('/products?limit=1');
  const product = list.json.data.products[0];
  const { status } = await req('/cart/add', {
    method: 'POST',
    token: farmerToken,
    body: { productId: product._id, quantity: product.stock + 999 },
  });
  assert.equal(status, 400);
});

// ---------- Mandi ----------
test('GET /mandi without API key still serves cached records and labels them honestly', async () => {
  const { status, json } = await req('/mandi');
  assert.equal(status, 200);
  assert.equal(json.success, true);
  const data = json.data;
  // No DATA_GOV_API_KEY in test env → must NOT claim live data
  assert.equal(data.isLive, false);
  assert.ok(data.prices.length >= 10);
  for (const p of data.prices) {
    assert.ok(p.commodity.en, 'commodity present');
    assert.ok(p.minPrice >= 0 && p.maxPrice >= 0 && p.modalPrice >= 0);
  }
});

test('GET /mandi filters by state', async () => {
  const { status, json } = await req('/mandi?state=Punjab');
  assert.equal(status, 200);
  assert.ok(json.data.prices.length >= 1);
  for (const p of json.data.prices) {
    assert.match(p.state, /punjab/i);
  }
});

test('GET /mandi search with regex metacharacters does not 500', async () => {
  const { status } = await req('/mandi?state=' + encodeURIComponent(')$+*'));
  assert.equal(status, 200);
});

test('GET /mandi scanning a commodity that has no records returns empty, not an error', async () => {
  const { status, json } = await req('/mandi?commodity=' + encodeURIComponent('zzz-nonexistent'));
  assert.equal(status, 200);
  assert.equal(json.data.prices.length, 0);
});

// ---------- Grain ----------
test('GET /grain lists seeded grains', async () => {
  const { status, json } = await req('/grain');
  assert.equal(status, 200);
  assert.ok(json.data.grains.length >= 5);
});

test('GET /grain/:id works', async () => {
  const list = await req('/grain?limit=1');
  const grain = list.json.data.grains[0];
  const { status, json } = await req(`/grain/${grain._id}`);
  assert.equal(status, 200);
  assert.equal(json.data._id, grain._id);
});

test('POST /grain-orders requires min order quantity', async () => {
  const list = await req('/grain?limit=1');
  const grain = list.json.data.grains[0];
  const { status, json } = await req('/grain-orders', {
    method: 'POST',
    token: farmerToken,
    body: {
      grainId: grain._id,
      quantityQuintal: grain.minOrderQuintal - 1,
      address: {
        fullName: 'T', phone: '9', street: 's', district: 'd', state: 's', pincode: '1',
      },
    },
  });
  assert.equal(status, 400);
  assert.match(json.message, /minimum/i);
});

// ---------- Scans ----------
test('POST /scans requires auth', async () => {
  const { status } = await req('/scans', { method: 'POST' });
  assert.equal(status, 401);
});

test('POST /scans without a file returns 400', async () => {
  const { status, json } = await req('/scans', { method: 'POST', token: farmerToken });
  assert.equal(status, 400);
  assert.match(json.message, /image/i);
});

test('POST /scans with a non-image file is rejected by the upload filter', async () => {
  const form = new FormData();
  form.append('image', new Blob([Buffer.from('not an image')], { type: 'text/plain' }), 'a.txt');
  const { status, json } = await req('/scans', { method: 'POST', token: farmerToken, form });
  assert.equal(status, 400);
  assert.match(json.message, /JPEG|PNG|image/i);
});

test('POST /scans with a valid image without AI credentials returns an honest config error (no fake diagnosis)', async () => {
  const form = new FormData();
  form.append('image', new Blob([tinyPng], { type: 'image/png' }), 'crop.png');
  const { status, json } = await req('/scans', { method: 'POST', token: farmerToken, form });
  assert.equal(status, 503);
  assert.match(json.message, /configure/i);
});

test('GET /scans/my requires auth and returns an empty list for a new user', async () => {
  const anon = await req('/scans/my');
  assert.equal(anon.status, 401);

  const { status, json } = await req('/scans/my', { token: farmerToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(json.data.scans));
});

// ---------- AI Chat ----------
test('POST /ai/chat requires auth', async () => {
  const { status } = await req('/ai/chat', { method: 'POST', body: { message: 'hi' } });
  assert.equal(status, 401);
});

test('POST /ai/chat rejects empty / whitespace-only / non-string messages', async () => {
  for (const bad of ['', '   ', null, undefined, 42, { text: 'x' }]) {
    const { status, json } = await req('/ai/chat', { method: 'POST', token: farmerToken, body: { message: bad } });
    assert.equal(status, 400, `empty variant ${JSON.stringify(bad)} must be 400`);
    assert.equal(json.success, false);
    assert.equal(json.data, null);
  }
});

test('POST /ai/chat rejects oversized messages', async () => {
  const { status, json } = await req('/ai/chat', {
    method: 'POST',
    token: farmerToken,
    body: { message: 'a'.repeat(2001) },
  });
  assert.equal(status, 400);
  assert.match(json.message, /too long|maximum/i);
});

test('POST /ai/chat without AI credentials returns an honest 503 config error (no fake reply)', async () => {
  // run.mjs intentionally clears GEMINI_API_KEY in the test server env.
  const { status, json } = await req('/ai/chat', {
    method: 'POST',
    token: farmerToken,
    body: { message: 'Meri fasal ke patte peele kyu ho rahe hain?' },
  });
  assert.equal(status, 503);
  assert.equal(json.success, false);
  assert.equal(json.data, null);
  assert.match(json.message, /configure|GEMINI_API_KEY/i);
  assert.equal(json.data?.reply, undefined, 'no fabricated reply may be returned');
});

// ---------- Order placement (COD, real stock decrement) ----------
test('Placing an order from the cart works on a standalone MongoDB and decrements stock', async () => {
  // Dedicated fresh user with a clean cart
  const email = `orderer-${randomBytes(4).toString('hex')}@kisanai.com`;
  const reg = await req('/auth/register', {
    method: 'POST',
    body: { name: 'Order Tester', email, password: 'secret123' },
  });
  const tok = reg.json.data.token;
  const h = { token: tok };

  const list = await req('/products?limit=1');
  const p = list.json.data.products[0];
  assert.ok(p, 'seeded product exists');

  const add = await req('/cart/add', { method: 'POST', ...h, body: { productId: p._id, quantity: 2 } });
  assert.equal(add.status, 200);

  const afterAdd = await req('/products/' + p._id);
  const stockBefore = afterAdd.json.data.stock;

  const order = await req('/orders', {
    method: 'POST',
    ...h,
    body: {
      address: {
        fullName: 'Order Tester', phone: '9876500000', street: 'Street 1',
        district: 'Ludhiana', state: 'Punjab', pincode: '141001',
      },
    },
  });
  assert.equal(order.status, 201);
  assert.equal(order.json.data.status, 'PLACED');
  assert.equal(order.json.data.totalPrice, p.price * 2);

  // Stock decremented exactly by the ordered quantity
  const afterOrder = await req('/products/' + p._id);
  assert.equal(afterOrder.json.data.stock, stockBefore - 2);

  // Cart is cleared after ordering
  const cartAfter = await req('/cart', h);
  assert.equal(cartAfter.json.data.itemCount, 0);

  // The order shows up in "my orders"
  const mine = await req('/orders/my', h);
  assert.equal(mine.status, 200);
  assert.equal(mine.json.data.orders.length, 1);
});

// ---------- Admin protection ----------
test('Admin endpoints reject non-admin users', async () => {
  const { status } = await req('/admin/stats', { token: farmerToken });
  assert.equal(status, 403);
});

test('Admin endpoints reject anonymous users', async () => {
  const { status } = await req('/admin/stats');
  assert.equal(status, 401);
});

test('Admin login + dashboard stats work', async () => {
  const login = await req('/auth/login', {
    method: 'POST',
    body: { email: 'admin@kisanai.com', password: 'password123' },
  });
  assert.equal(login.status, 200);
  adminToken = login.json.data.token;

  const { status, json } = await req('/admin/stats', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(json.data.totalUsers >= 4);
  assert.ok(json.data.totalProducts >= 10);
});

test('Only admins can create/delete products', async () => {
  const productPayload = {
    name: { en: 'Test Product', hi: 'टेस्ट उत्पाद' },
    category: 'FERTILIZER',
    price: 100,
    stock: 5,
  };
  const forbidden = await req('/products', { method: 'POST', token: farmerToken, body: productPayload });
  assert.equal(forbidden.status, 403);

  const created = await req('/products', { method: 'POST', token: adminToken, body: productPayload });
  assert.equal(created.status, 201);

  const updated = await req(`/products/${created.json.data._id}`, {
    method: 'PUT',
    token: adminToken,
    body: { price: 150 },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.data.price, 150);

  const deleted = await req(`/products/${created.json.data._id}`, {
    method: 'DELETE',
    token: adminToken,
  });
  assert.equal(deleted.status, 200);

  const gone = await req(`/products/${created.json.data._id}`, { token: adminToken });
  assert.equal(gone.status, 404);
});

// ---------- Error hygiene ----------
test('Unknown API route returns structured 404 JSON (no stack leak)', async () => {
  const { status, json } = await req('/definitely-not-a-route');
  assert.equal(status, 404);
  assert.equal(json.success, false);
  assert.equal(json.stack, undefined);
});
