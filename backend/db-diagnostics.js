const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

// Fix for Node.js 18+ DNS resolution order issue with MongoDB Atlas
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');

const runDiagnostics = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected successfully!');

    // 1. Total user count
    const totalUsers = await User.countDocuments();
    console.log(`\n[1] Total Users in Database: ${totalUsers}`);

    // 2. Count by role
    const rolesCount = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    console.log('\n[2] User Count by Role:');
    rolesCount.forEach(r => {
      console.log(`  - ${r._id || 'undefined'}: ${r.count}`);
    });

    // 3. Find duplicate emails
    const duplicateEmails = await User.aggregate([
      { $group: { _id: { $toLower: '$email' }, count: { $sum: 1 }, ids: { $push: '$_id' }, roles: { $push: '$role' } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    console.log(`\n[3] Duplicate Emails: ${duplicateEmails.length}`);
    if (duplicateEmails.length > 0) {
      duplicateEmails.forEach(dup => {
        console.log(`  - Email: ${dup._id}`);
        console.log(`    Occurrences: ${dup.count}`);
        console.log(`    Roles: [${dup.roles.join(', ')}]`);
      });
    } else {
      console.log('  - No duplicate email accounts found!');
    }

    mongoose.connection.close();
  } catch (error) {
    console.error('\nDiagnostics failed:', error.message);
    process.exit(1);
  }
};

runDiagnostics();
