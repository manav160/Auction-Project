// One-time script to drop the old email-only unique index
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // List current indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));

    // Drop the old email_1 unique index if it exists
    for (const idx of indexes) {
      if (idx.key && idx.key.email && !idx.key.role && idx.name !== '_id_') {
        console.log(`Dropping old index: ${idx.name}`);
        await collection.dropIndex(idx.name);
        console.log('Old email-only index dropped successfully');
      }
    }

    // The new compound index will be created automatically by Mongoose when the model is used
    console.log('Index fix complete. You can now restart the server.');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixIndexes();