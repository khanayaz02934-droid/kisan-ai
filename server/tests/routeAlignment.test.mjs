/**
 * Static route-alignment guard (no server, no network).
 *
 * Guards against the production bug class that returned
 *   { success: false, message: "Not Found - /api/auth/register" }
 * when the frontend and backend disagreed on API routes.
 *
 * It parses, without executing them:
 *   1. server/server.js            → every `app.use('/api/<prefix>', ...)` mount
 *   2. server/routes/*.js          → every `router.{method}('...')` endpoint
 *   3. client/src/services/index.js→ every `api.{method}('...')` call
 * and asserts every client call has a matching server endpoint, and every
 * mounted router file actually exists.
 *
 * Usage: node --test server/tests/routeAlignment.test.mjs  (also in npm test)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

// ---- 1) Mounted prefixes ---------------------------------------------------
const serverJs = read('server/server.js');
const mounts = [...serverJs.matchAll(/app\.use\('\/api\/([a-zA-Z0-9-]+)',\s*(\w+)\);/g)]
  .map((m) => ({ prefix: m[1], routerVar: m[2] }));

test('server.js mounts the /api/auth router with the auth routes file', () => {
  const auth = mounts.find((m) => m.prefix === 'auth');
  assert.ok(auth, "server.js must mount the auth router at '/api/auth'");
  // Auth endpoints live in /register, /login, /me, /profile → resolved below
  // via the imported routes file; the mount is what this test class guards.
  assert.match(auth.routerVar, /auth/i);
});

// ---- 2) Router files: maps each mounted prefix to declared endpoints -------
const routerFiles = {
  auth: 'server/routes/authRoutes.js',
  products: 'server/routes/productRoutes.js',
  cart: 'server/routes/cartRoutes.js',
  orders: 'server/routes/orderRoutes.js',
  scans: 'server/routes/scanRoutes.js',
  mandi: 'server/routes/mandiRoutes.js',
  grain: 'server/routes/grainRoutes.js',
  'grain-orders': 'server/routes/grainOrderRoutes.js',
  admin: 'server/routes/adminRoutes.js',
  ai: 'server/routes/aiRoutes.js',
};

// Extract [METHOD, segments[]] from a routes file. Router-level rate-limit
// middlewares and protect() are ignored — only method + path matter here.
const parseRouterEndpoints = (src) =>
  [...src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)].map((m) => ({
    method: m[1].toUpperCase(),
    segments: m[2].split('?')[0].split('/').filter(Boolean),
  }));

for (const { prefix, routerVar } of mounts) {
  const file = routerFiles[prefix];
  test(`mount '/api/${prefix}' (${routerVar}) has an existing routes file with at least one endpoint`, () => {
    assert.ok(file, `no routes-file mapping in routeAlignment.test.mjs for '/api/${prefix}' — add it above`);
    const abs = path.join(root, file);
    assert.ok(existsSync(abs), `routes file missing: ${file}`);
    const endpoints = parseRouterEndpoints(read(file));
    assert.ok(
      endpoints.length > 0,
      `${file} declares no endpoints — is it empty or was it replaced by another router name?`
    );
  });
}

// ---- 3) Client calls must match declared server endpoints ------------------
const clientServices = read('client/src/services/index.js');

// Match api.get('...'), api.post('...') etc., accepting both '...' and `...`
// template literals (template ${...} placeholders become dynamic segments).
const clientCalls = [...clientServices.matchAll(/api\.(get|post|put|patch|delete)\(\s*(['`])([^'`]+)\2/g)].map(
  (m) => ({
    method: m[1].toUpperCase(),
    rawPath: m[3],
    // `${id}` style placeholders → dynamic segment marker, like server ':id'
    segments: m[3]
      .replace(/\$\{[^}]+\}/g, ':dynamic')
      .split('?')[0]
      .split('/')
      .filter(Boolean),
  })
);

const serverEndpoints = new Map(); // prefix → endpoints[]
for (const { prefix } of mounts) {
  if (routerFiles[prefix]) {
    serverEndpoints.set(
      prefix,
      parseRouterEndpoints(readFileSync(path.join(root, routerFiles[prefix]), 'utf8')).map((e) => ({
        ...e,
        // ':anything' on the server is a dynamic segment, same as ':dynamic'
        segments: e.segments.map((s) => (s.startsWith(':') ? ':dynamic' : s)),
      }))
    );
  }
}

const segmentMatches = (client, server) =>
  client.length === server.length &&
  client.every((c, i) => c === server[i] || c === ':dynamic' || server[i] === ':dynamic');

const findMatch = (call, restrictPrefix = null) => {
  const candidates = [];
  for (const [prefix, endpoints] of serverEndpoints) {
    if (restrictPrefix && prefix !== restrictPrefix) continue;
    for (const ep of endpoints) {
      // Client segment list starts with the mount-prefix itself.
      const rest = call.segments.slice(1);
      if (call.segments[0] !== prefix) continue;
      if (ep.method !== call.method) {
        // Record same-path/different-method hits for precise failure messages.
        if (segmentMatches(rest, ep.segments)) candidates.push(ep.method + ' (same path, wrong method)');
        continue;
      }
      if (segmentMatches(rest, ep.segments)) return 'match';
    }
  }
  return candidates[0] || null;
};

test('client services define API calls (guard against a broken parser)', () => {
  assert.ok(clientCalls.length >= 20, 'expected to find the ~40 client api calls');
});

for (const call of clientCalls) {
  test(`client api.${call.method.toLowerCase()}('${call.rawPath}') has a matching server route`, () => {
    const hint = findMatch(call);
    assert.ok(
      hint === 'match',
      hint
        ? `client path '${call.rawPath}' resolves on the server with ${hint} — fix the client method or url`
        : `no server endpoint matches '${call.rawPath}' — check the mount prefix in server/server.js and the routes file`
    );
  });
}

test('auth register/login are served by the dedicated auth controller (no duplicates)', () => {
  const authEndpoints = serverEndpoints.get('auth') || [];
  const register = authEndpoints.filter((e) => e.method === 'POST' && e.segments[0] === 'register');
  const login = authEndpoints.filter((e) => e.method === 'POST' && e.segments[0] === 'login');
  assert.equal(register.length, 1, 'exactly one POST /register route may exist');
  assert.equal(login.length, 1, 'exactly one POST /login route may exist');
});
