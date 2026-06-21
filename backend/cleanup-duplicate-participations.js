const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const Participation = require('./models/Participation');
const Auction = require('./models/Auction');
// This script cleans up duplicate participations in the database.
async function cleanupDuplicates() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  
  // Find all participations grouped by auctionId+userId...
  const all = await Participation.find({}).sort({ createdAt: 1 });

  const seen = new Map();
  const toDelete = [];
  for (const p of all) {
    const key = `${p.auctionId}_${p.userId}`;// unique key for each auctionId+userId combination
    if (seen.has(key)) {
      toDelete.push(p._id); // duplicate — mark for deletion
    } else {
      seen.set(key, p._id);//   first occurrence — keep it
    }
  }

  if (toDelete.length === 0) {
    console.log('No duplicates found.');
  } else {
    await Participation.deleteMany({ _id: { $in: toDelete } });
    console.log(`Deleted ${toDelete.length} duplicate participation(s).`);

    // Recalculate participantsCount for all affected auctions
    const affectedAuctions = [...new Set(all.map(p => p.auctionId.toString()))];
    for (const auctionId of affectedAuctions) {
      const count = await Participation.countDocuments({ auctionId });
      await Auction.findByIdAndUpdate(auctionId, { participantsCount: count });
      console.log(`Fixed auction ${auctionId} → participantsCount = ${count}`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

cleanupDuplicates().catch(err => { console.error(err); process.exit(1); });