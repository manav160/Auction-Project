const mongoose = require('mongoose');

/**
 * Executes a callback within a managed MongoDB transaction session.
 * Handles commit, abort, and session cleanup automatically.
 */
const withTransaction = async (callback) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = { withTransaction };
