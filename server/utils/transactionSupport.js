import mongoose from 'mongoose';

let supported = null; // cached

/**
 * Does this MongoDB deployment support multi-document transactions?
 * Standalone servers (typical local dev via `mongodb://localhost:27017/...`)
 * do NOT — explicit transactions require a replica set or sharded cluster.
 * The result is cached for the process lifetime.
 */
export const supportsTransactions = async () => {
  if (supported !== null) return supported;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    // Replica set members expose setName; mongos exposes isdbgrid via msg.
    supported = Boolean(hello.setName) || (Array.isArray(hello.msg) && hello.msg.includes('isdbgrid'));
  } catch (error) {
    console.error('[db] Could not determine transaction support:', error.message);
    supported = false;
  }
  return supported;
};

export default supportsTransactions;
