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

// Helper to ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

const runBackup = async () => {
  try {
    console.log('Connecting to MongoDB for backup...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected successfully!');

    const collections = ['users', 'auctions', 'bids', 'participations'];

    for (const collName of collections) {
      console.log(`Backing up collection: ${collName}...`);
      const data = await mongoose.connection.db.collection(collName).find({}).toArray();
      const filePath = path.join(backupDir, `${collName}_backup.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`  - Backed up ${data.length} documents to ${filePath}`);
    }

    console.log('\n=========================================');
    console.log('Backup completed successfully!');
    console.log(`All backups saved in: ${backupDir}`);
    console.log('=========================================');
    console.log('\nRESTORE PROCEDURE INSTRUCTIONS:');
    console.log('If you need to restore the data, you can run the restore script by calling:');
    console.log('  node db-restore.js');
    console.log('=========================================\n');

    mongoose.connection.close();
  } catch (error) {
    console.error('Backup failed:', error.message);
    process.exit(1);
  }
};

runBackup();
