const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Run migration: drop old index and ensure new one
    await runParticipationMigration();
    await runUserMigration();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const runUserMigration = async () => {
  try {
    const User = require('../models/User');
    console.log('[Migration] Starting user role & index migration...');

    // 1. Drop old compound index if exists
    try {
      await User.collection.dropIndex('email_1_role_1');
      console.log('[Migration] Dropped compound index email_1_role_1');
    } catch (err) {
      console.log('[Migration] No compound index email_1_role_1 to drop');
    }

    // 2. Update buyer/seller roles to user
    const updateResult = await User.updateMany(
      { role: { $in: ['buyer', 'seller'] } },
      { $set: { role: 'user' } }
    );
    console.log(`[Migration] Migrated ${updateResult.modifiedCount || 0} accounts to 'user'`);

    // 3. Ensure unique index on email
    await User.collection.createIndex({ email: 1 }, { unique: true });
    console.log('[Migration] Ensured unique index on email');

    console.log('[Migration] User migration completed successfully!');
  } catch (error) {
    console.error('[Migration] Error migrating users:', error.message);
  }
};

const runParticipationMigration = async () => {
  try {
    const Participation = require('../models/Participation');
    const User = require('../models/User');

    console.log('[Migration] Starting participation email migration...');

    // Step 1: Get all participations
    const allParticipations = await Participation.find({});
    console.log(`[Migration] Found ${allParticipations.length} participations`);

    // Step 2: Populate email for participations that don't have it
    let updated = 0;
    for (const participation of allParticipations) {
      if (!participation.email) {
        const user = await User.findById(participation.userId);
        if (user) {
          participation.email = user.email;
          await participation.save();
          updated++;
        }
      }
    }
    console.log(`[Migration] Updated ${updated} participations with email`);

    // Step 3: Find and remove duplicate participations (keep first by joinedAt)
    const grouped = {};//it contains the unique participations based on auctionId and email
    const toDelete = [];//

    for (const participation of allParticipations) {
      const key = `${participation.auctionId.toString()}_${participation.email}`;
      
      if (!grouped[key]) //first time we see this auctionId and email combination, we keep it
        {
        grouped[key] = participation;
      } else {
        // Keep the first one, mark the rest for deletion
        toDelete.push(participation._id);
      }
    }

    if (toDelete.length > 0) {//if we have duplicates, we delete them
      await Participation.deleteMany({ _id: { $in: toDelete } });//delete all the duplicates
      console.log(`[Migration] Deleted ${toDelete.length} duplicate participations`);
    } else {
      console.log('[Migration] No duplicate participations found');
    }

    // Step 4: Drop old index if it exists
    try {
      await Participation.collection.dropIndex('auctionId_1_userId_1');
      console.log('[Migration] Dropped old userId index');
    } catch (e) {
      // Index may not exist, that's fine
      console.log('[Migration] No old userId index to drop');
    }

    // Step 5: Ensure new unique index
    await Participation.collection.createIndex({ auctionId: 1, email: 1 }, { unique: true });
    console.log('[Migration] Ensured unique index on auctionId and email');

    console.log('[Migration] Participation migration completed successfully!');
  } catch (error) {
    console.error('[Migration] Error during migration:', error.message);
    // Don't exit - migration is not critical
  }
};

module.exports = connectDB;// Export the connectDB function to be used in server.js
