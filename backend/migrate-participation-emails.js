const mongoose = require('mongoose');
const User = require('./models/User');
const Participation = require('./models/Participation');
require('dotenv').config();

async function migrateParticipationEmails() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Step 1: Get all participations
    const allParticipations = await Participation.find({}).sort({ createdAt: 1 });
    console.log(`Found ${allParticipations.length} participations`);

    // Step 2: Populate email for each participation
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
    console.log(`Updated ${updated} participations with email`);

    // Step 3: Find and remove duplicate participations (keep first by joinedAt)
    const grouped = {};
    const toDelete = [];

    for (const participation of allParticipations) {
      const key = `${participation.auctionId.toString()}_${participation.email}`;
      
      if (!grouped[key]) {
        grouped[key] = participation;
      } else {
        // Keep the first one, mark the rest for deletion
        toDelete.push(participation._id);
      }
    }

    if (toDelete.length > 0) {
      await Participation.deleteMany({ _id: { $in: toDelete } });
      console.log(`Deleted ${toDelete.length} duplicate participations`);
    } else {
      console.log('No duplicate participations found');
    }

    // Step 4: Drop old index if it exists
    try {
      await Participation.collection.dropIndex('auctionId_1_userId_1');
      console.log('Dropped old userId index');
    } catch (e) {
      console.log('No old userId index to drop');
    }

    // Step 5: Ensure new unique index
    await Participation.collection.createIndex({ auctionId: 1, email: 1 }, { unique: true });
    console.log('Created unique index on auctionId and email');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

migrateParticipationEmails();
