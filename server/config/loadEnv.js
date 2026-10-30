import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Plain `import 'dotenv/config'` loads process.cwd()/.env, so starting the
// server from any directory other than the project root silently loads the
// WRONG (or no) .env — e.g. placeholder or missing Cloudinary credentials —
// even though kisan-ai/.env at the project root is correct, which made the
// scan upload fail with "Image storage is misconfigured...".
// Resolve the project root relative to THIS file so the server, the
// cloudinary self-test script, and the tests always load the same file.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

dotenv.config({ path: path.join(projectRoot, '.env') });
