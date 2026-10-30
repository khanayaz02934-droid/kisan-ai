import './loadEnv.js';
import { cloudinaryIssues } from './cloudinary.js';

const required = ['MONGO_URI', 'JWT_SECRET'];

const missing = required.filter((name) => !process.env[name] || !process.env[name].trim());

if (missing.length > 0) {
  console.error(
    `\n[FATAL] Missing required environment variables: ${missing.join(', ')}\n` +
      'Create a .env file in the project root (see .env.example) and set:\n' +
      '  - MONGO_URI   : MongoDB connection string\n' +
      '  - JWT_SECRET  : random hex secret (node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")\n'
  );
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 16) {
  console.error(
    '[FATAL] JWT_SECRET is too short (min 16 characters). Use a random 32+ byte hex string.'
  );
  process.exit(1);
}

// Warn (do not crash) about optional-but-needed-for-features credentials so the
// developer knows exactly which feature will be degraded.
if (!process.env.GEMINI_API_KEY) {
  console.warn(
    '[warn] GEMINI_API_KEY not set - AI crop scan analysis will fail until it is configured.'
  );
}
if (!process.env.DATA_GOV_API_KEY) {
  console.warn(
    '[warn] DATA_GOV_API_KEY not set - mandi prices will only show cached/manual records.'
  );
}
if (cloudinaryIssues.length > 0) {
  console.warn(
    '[warn] Cloudinary image storage is misconfigured - crop scan uploads will fail. Exact problems:'
  );
  for (const issue of cloudinaryIssues) {
    console.warn(`[warn]   - ${issue}`);
  }
  console.warn(
    '[warn] Copy your Cloud Name, API Key, and API Secret from the Cloudinary Dashboard ' +
      '(https://console.cloudinary.com -> Settings -> API Keys) into the backend .env ' +
      '(kisan-ai/.env at the project root), then restart the server.'
  );
}

export const envValidated = true;
