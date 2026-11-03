/**
 * Test runner: seeds a DEDICATED test database, starts the backend on a test
 * port with test-tuned env pointing at that SAME test database, waits for
 * /api/health, runs the integration tests, then shuts down.
 *
 * The test database is derived from MONGO_URI by appending "-test" to the
 * database name (or overridden entirely with TEST_MONGO_URI). Production data
 * (MONGO_URI itself) is NEVER read or written by the test suite.
 * Usage: npm test
 */
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

// mongodb+srv://host/db?opts | mongodb://host/db → ":db-test" (preserving opts)
const toTestUri = (uri) => {
  if (process.env.TEST_MONGO_URI) return process.env.TEST_MONGO_URI;
  if (!uri) return 'mongodb://localhost:27017/kisan-ai-test';
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/([^?]*))?(.*)$/);
  if (!match) return 'mongodb://localhost:27017/kisan-ai-test';
  const [, prefix, rawDb, suffix] = match;
  const baseName = rawDb && rawDb.trim() ? rawDb.trim() : 'kisan-ai';
  return `${prefix}/${baseName}-test${suffix || ''}`;
};

// Absent MONGO_URI in CI-ish environments stays a FATAL (config/db.js exits);
// deriving the test URI from it keeps both cases consistent.
const TEST_URI = toTestUri(process.env.MONGO_URI);

const PORT = process.env.TEST_PORT || '5100';
const childEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PORT,
  // Tests always run against the dedicated test database.
  MONGO_URI: TEST_URI,
  // Tests intentionally exercise auth many times from one IP.
  AUTH_RATE_LIMIT_MAX: '1000',
};

// Do not let a developer's real AI/Cloudinary/data.gov keys be consumed by tests.
// Set them to empty strings (do NOT just delete them): the server child process
// runs `import 'dotenv/config'`, which loads .env for any key left undefined —
// an empty string here wins, and dotenv never overwrites an existing variable.
for (const key of ['GEMINI_API_KEY', 'DATA_GOV_API_KEY', 'CLOUDINARY_URL', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
  childEnv[key] = '';
}

// 1) Unit tests (no server, no network): Gemini retry / fallback / failure logic.
const unit = spawnSync(
  process.execPath,
  [
    '--test',
    'server/tests/geminiService.test.mjs',
    'server/tests/geminiChatService.test.mjs',
    'server/tests/adminUserGuards.test.mjs',
  ],
  { cwd: process.cwd(), stdio: 'inherit', env: childEnv }
);
if (unit.status) {
  process.exit(unit.status);
}

// 2) Seed the DEDICATED test database (wipe + fixtures). Only ever targets
//    TEST_URI — the production database (MONGO_URI) is never touched.
console.log(`[test] Seeding test database: ${TEST_URI.replace(/\/\/[^@]+@/, '//<redacted>@')}`);
const seed = spawnSync(process.execPath, ['seed.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: childEnv,
});
if (seed.status) {
  console.error('Seeding the test database failed — aborting tests.');
  process.exit(seed.status || 1);
}

// 3) Integration tests: start the server (same test DB), run api.test.mjs.
const server = spawn(process.execPath, ['server/server.js'], {
  env: childEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: false,
});

server.stdout.on('data', (d) => process.stdout.write(d));
server.stderr.on('data', (d) => process.stderr.write(d));

const base = `http://localhost:${PORT}`;
let healthTicks = 0;
let up = false;
while (healthTicks < 60 && !up) {
  healthTicks += 1;
  try {
    const res = await fetch(`${base}/api/health`);
    up = res.ok;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

if (!up) {
  console.error('Server did not come up — aborting tests.');
  server.kill();
  process.exit(1);
}

const res = spawnSync(process.execPath, ['server/tests/api.test.mjs'], {
  stdio: 'inherit',
  env: { ...childEnv, TEST_BASE_URL: `${base}/api` },
});

server.kill();
process.exit(res.status || 0);
