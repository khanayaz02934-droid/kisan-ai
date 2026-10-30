import './loadEnv.js';

// NOTE: The Cloudinary SDK reads CLOUDINARY_URL at import time. It throws
// "Invalid CLOUDINARY_URL protocol" if the URL does not start with
// 'cloudinary://', and — worse — it silently accepts a placeholder URL like
// "cloudinary://<your_api_key>:<your_api_secret>@<cloud_name>" and later fails
// with "Invalid api_key %3Cyour_api_key%3E" (the placeholder is URL-encoded).
// A CLOUDINARY_URL in the env also PRECEDES the separate
// CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET values,
// so a stale placeholder there can override real credentials.
// Sanitize the env BEFORE loading the SDK so a bad placeholder can never
// crash the server or override valid separate credentials.
const rawUrl = process.env.CLOUDINARY_URL;
const PLACEHOLDER_RE = /<|>|%3C|%3E|your_|placeholder|example|\.\.\./i;
const urlIsValid =
  rawUrl &&
  rawUrl.startsWith('cloudinary://') &&
  !PLACEHOLDER_RE.test(rawUrl.slice('cloudinary://'.length));
if (rawUrl && !urlIsValid) {
  if (PLACEHOLDER_RE.test(rawUrl)) {
    console.warn(
      '[cloudinary] Ignoring CLOUDINARY_URL because it contains placeholder ' +
        'credentials (e.g. <your_api_key>). Configure real values in the backend .env: ' +
        'either CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME ' +
        'OR all three of CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.'
    );
  } else {
    console.warn(
      "[cloudinary] Ignoring invalid CLOUDINARY_URL (must start with 'cloudinary://'). " +
        'Using separate CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET instead.'
    );
  }
  delete process.env.CLOUDINARY_URL;
}

// Dynamic import AFTER sanitizing, so the SDK never sees the invalid value.
const { v2: cloudinary } = await import('cloudinary');

const isPlaceholder = (v) =>
  !v || v.trim() === '' || v.includes('your_') || v.includes('placeholder') || v.includes('example');

// Exact per-variable configuration problems. NEVER include the values —
// only variable names and what is wrong with them.
const CLOUDINARY_KEYS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const cloudinaryIssues = CLOUDINARY_KEYS.map((name) => {
  const raw = process.env[name];
  const value = (raw || '').trim();
  if (!raw) return `${name} is NOT set`;
  if (value === '') return `${name} is set but EMPTY`;
  if (isPlaceholder(value)) return `${name} still contains a PLACEHOLDER value`;
  return null;
}).filter(Boolean);

const hasValidUrl = !!process.env.CLOUDINARY_URL;
const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
const hasSeparateCreds = cloudinaryIssues.length === 0;

let configured = false;

if (hasValidUrl) {
  // SDK auto-configured itself from the valid CLOUDINARY_URL. Enforce HTTPS URLs.
  cloudinary.config({ secure: true });
  configured = true;
} else if (hasSeparateCreds) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  configured = true;
} else {
  // Do NOT throw on startup and do NOT log here — the server stays bootable so
  // health checks and non-upload routes work. Startup reporting is done once in
  // config/validateEnv.js (which names each exact variable that needs fixing),
  // and uploads fail at request time with the clear 503 message in
  // controllers/scanController.js.
}

export { configured as cloudinaryConfigured, cloudinaryIssues };
export default cloudinary;
