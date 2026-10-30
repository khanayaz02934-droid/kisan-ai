// Cloudinary configuration self-test.
//
// Run from the PROJECT ROOT:   node server/scripts/check-cloudinary.mjs
//
// What it does:
//   1. Loads the same .env as `npm run dev` (kisan-ai/.env at the project root).
//   2. Reports exactly which Cloudinary variable is missing/placeholder (if any),
//      WITHOUT ever printing credential values.
//   3. If the three variables are present, performs a REAL 1x1 pixel upload to
//      the "kisan-ai/self-test" folder to verify the credentials actually work.
//
// Security notes:
//   - Only http_code and public_id/secure_url are printed; never api_key/api_secret.
//   - Never hardcodes, invents, or fabricates credentials in this script.

import cloudinary, { cloudinaryConfigured, cloudinaryIssues } from '../config/cloudinary.js';

if (!cloudinaryConfigured) {
  console.log('❌ Cloudinary is NOT configured. Exact problems in the backend .env:');
  for (const issue of cloudinaryIssues) {
    console.log(`   - ${issue}`);
  }
  console.log('');
  console.log(
    'FIX: open the Cloudinary Dashboard (https://console.cloudinary.com -> ' +
      'Settings -> API Keys) and copy the real Cloud Name, API Key, and API Secret ' +
      'into kisan-ai/.env (project root), then re-run this script.'
  );
  process.exit(1);
}

// Tiny valid 1x1 transparent PNG — intentionally trivial so the test asset is
// easy to identify and delete from the Cloudinary Media Library.
const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

console.log('✅ Configuration check passed. Verifying credentials with a real upload...');
console.log('   (a 1x1 test image will be placed in folder "kisan-ai/self-test")');

let result;
try {
  result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'kisan-ai/self-test', resource_type: 'image' },
      (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
    );
    stream.end(TEST_PNG);
  });
} catch (uploadError) {
  // Deliberately print only the http_code — some Cloudinary auth error
  // messages can echo back parts of the credentials (e.g. "Invalid api_key"),
  // so the raw message is NEVER logged.
  const httpCode = uploadError?.http_code ?? 'unknown';
  console.log('');
  console.log(`❌ REAL UPLOAD REJECTED BY CLOUDINARY (http_code=${httpCode}).`);
  if (httpCode === 401) {
    console.log(
      '   Meaning: Cloudinary rejected the API Key / API Secret pair in the backend .env.\n' +
        '   They look real but are NOT accepted. This is exactly what happens with\n' +
        '   credentials copied incompletely or from a different Cloudinary account.\n' +
        '   FIX: in the Cloudinary Dashboard, go to Settings -> API Keys, generate a\n' +
        '   fresh pair, and replace ALL THREE lines in kisan-ai/.env:\n' +
        '     CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET\n' +
        '   Copy each value in FULL (the API Secret is usually 27 characters).\n' +
        '   Then re-run this script.'
    );
  } else if (httpCode === 403) {
    console.log(
      '   Meaning: the account rejected the operation (e.g. uploading is disabled\n' +
        '   for the account/preset). Check the Security settings in the Cloudinary Dashboard.'
    );
  } else {
    console.log('   Meaning: unexpected Cloudinary/API error. Retry and check connectivity.');
  }
  process.exit(1);
}

console.log('');
console.log('🎉 SUCCESS: credentials in the backend .env are VALID and uploads work.');
console.log(`   public_id : ${result.public_id}`);
console.log(`   secure_url: ${result.secure_url}`);
console.log('   (You can delete this test image in the Cloudinary Dashboard media library.)');

// Cleanup: remove the self-test asset so the account is left tidy.
try {
  await cloudinary.uploader.destroy(result.public_id);
  console.log('   Self-test image deleted from Cloudinary automatically.');
} catch (cleanupError) {
  console.log('   (Could not auto-delete the test image — remove it manually if desired.)');
}
