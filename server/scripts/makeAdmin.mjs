/**
 * Promote an existing user to ADMIN, or create one if the email is not
 * registered yet. Safe for production: it never deletes or changes any other
 * document, and it refuses to demote/modify random accounts unexpectedly.
 *
 * Usage:
 *   node server/scripts/makeAdmin.mjs <email>            promote existing user
 *   node server/scripts/makeAdmin.mjs <email> <password> create+promote (min 6 chars)
 *
 * The created/promoted account keeps working exactly like any other admin:
 * log in via the normal /login page and you are redirected to /admin.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import colors from 'colors';

import User from '../models/userModel.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kisan-ai';

const [,, emailArg, passwordArg] = process.argv;

if (!emailArg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailArg)) {
  console.error('Usage: node server/scripts/makeAdmin.mjs <email> [password]'.yellow);
  process.exit(1);
}
const email = emailArg.trim().toLowerCase();

if (passwordArg && passwordArg.length < 6) {
  console.error('Password must be at least 6 characters.'.red);
  process.exit(1);
}

try {
  await mongoose.connect(MONGO_URI);
  console.log(`Connected database: ${mongoose.connection.name}`.cyan);

  let user = await User.findOne({ email });

  if (user && user.deletedAt) {
    console.error(
      `[ABORTED] ${email} is a soft-deleted account. Register it again from the app or pick another email.`.red.bold
    );
    process.exit(1);
  }

  if (!user) {
    if (!passwordArg) {
      console.error(
        `\nNo user with email ${email} exists yet. Re-run with a password to create it:\n` +
          `  node server/scripts/makeAdmin.mjs ${email} <new-password>\n`.yellow
      );
      process.exit(1);
    }
    user = new User({
      name: 'Kisan Admin',
      email,
      password: passwordArg, // hashed by the model's pre-save hook below
      userType: 'ADMIN',
      isActive: true,
    });
    console.log(`Admin account created: ${email}`.green.bold);
  } else {
    console.log(`Existing user promoted to ADMIN: ${email}`.green.bold);
  }

  user.userType = 'ADMIN';
  user.isActive = true;
  if (passwordArg) user.password = passwordArg; // hashed by the pre-save hook
  await user.save();

  console.log('Done. Log in via the normal /login page — admins land on /admin.'.cyan);
} catch (error) {
  console.error('FAILED'.red.bold, error.message);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.'.cyan);
  }
}
