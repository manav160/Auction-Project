const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns');

// Fix for Node.js 18+ DNS resolution order issue with MongoDB Atlas
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

dotenv.config({ path: path.join(__dirname, '.env') });

const backupDir = path.join(__dirname, 'backup');

const runRestore = async () => {
  try {
    console.log('Connecting to MongoDB for restore...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected successfully!');

    const collections = ['users', 'auctions', 'bids', 'participations'];

    for (const collName of collections) {
      const filePath = path.join(backupDir, `${collName}_backup.json`);
      if (!fs.existsSync(filePath)) {
        console.warn(`Backup file not found for collection: ${collName}, skipping.`);
        continue;
      }

      console.log(`Restoring collection: ${collName}...`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Convert string IDs back to ObjectIds for Mongoose compatibility
      const parsedData = data.map(doc => {
        const parsed = { ...doc };
        if (parsed._id) parsed._id = new mongoose.Types.ObjectId(parsed._id);
        
        // Convert any date strings back to Date objects
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            parsed[key] = new Date(value);
          }
        }
        
        // Parse reference IDs
        if (parsed.sellerId) parsed.sellerId = new mongoose.Types.ObjectId(parsed.sellerId);
        if (parsed.winnerId) parsed.winnerId = new mongoose.Types.ObjectId(parsed.winnerId);
        if (parsed.auctionId) parsed.auctionId = new mongoose.Types.ObjectId(parsed.auctionId);
        if (parsed.userId) parsed.userId = new mongoose.Types.ObjectId(parsed.userId);
        
        return parsed;
      });

      // Drop existing collection
      try {
        await mongoose.connection.db.dropCollection(collName);
        console.log(`  - Dropped current collection: ${collName}`);
      } catch (err) {
        console.log(`  - Collection ${collName} did not exist or could not be dropped.`);
      }

      if (parsedData.length > 0) {
        await mongoose.connection.db.collection(collName).insertMany(parsedData);
        console.log(`  - Restored ${parsedData.length} documents into ${collName}`);
      } else {
        console.log(`  - Backup for ${collName} was empty, collection left empty.`);
      }
    }

    console.log('\n=========================================');
    console.log('Restore completed successfully!');
    console.log('=========================================\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }
};

runRestore();
