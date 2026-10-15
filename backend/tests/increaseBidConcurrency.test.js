// Fix DNS resolution for MongoDB Atlas on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const assert = require('assert');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Auction = require('../models/Auction');
const Participation = require('../models/Participation');
const BiddingService = require('../services/biddingService');
const PlatformSettingsService = require('../services/platformSettingsService');

async function createTestUser(name, initialBalance = 50000) {
  const user = await User.create({
    name,
    email: `${Date.now()}_${Math.random().toString(36).slice(2)}@incbid.com`,
    password: 'password123',
    role: 'user'
  });
  await Wallet.create({
    userId: user._id,
    availableBalance: initialBalance,
    lockedBalance: 0,
    version: 0
  });
  return user;
}

async function createTestAuction(sellerId, startingPrice = 5000) {
  return await Auction.create({
    title: 'Increase Bid Concurrency Test Item',
    description: 'Testing concurrent increaseBid',
    startingPrice,
    currentHighestBid: startingPrice,
    sellerId,
    bidIncrementOptions: [100, 500, 1000],
    endDate: new Date(Date.now() + 86400000),
    status: 'ACTIVE'
  });
}

async function addParticipant(auctionId, userId) {
  await Participation.create({ auctionId, userId, entryFeePaid: 0 }).catch(() => {});
}

async function runTests() {
  console.log('Connecting to MongoDB for Increase Bid Concurrency Test...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB Connected.\n');

  await PlatformSettingsService.getSettings();

  try {
    console.log('==================================================');
    console.log('TEST: Concurrent Increase Bids — 4 users clicking increase by ₹500 simultaneously');
    console.log('==================================================');

    const seller = await createTestUser('Seller_Inc');
    const auction = await createTestAuction(seller._id, 5000);

    const users = [];
    for (let i = 0; i < 4; i++) {
      const u = await createTestUser(`Bidder_Inc_${i}`);
      users.push(u);
      await addParticipant(auction._id, u._id);
    }

    // Simultaneously trigger placeBid with increment: 500
    const incPromises = users.map((u) =>
      BiddingService.placeBid({
        auctionId: auction._id,
        userId: u._id,
        increment: 500
      }).then(r => ({ status: 'fulfilled', value: r, userId: u._id }))
        .catch(err => ({ status: 'rejected', reason: err, userId: u._id }))
    );

    const outcomes = await Promise.all(incPromises);

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    const rejected = outcomes.filter(o => o.status === 'rejected');

    console.log(`  Fulfilled: ${fulfilled.length}, Rejected: ${rejected.length}`);
    for (const r of rejected) {
      console.log(`    Rejected for user ${r.userId}: ${r.reason?.message}`);
    }

    const finalAuction = await Auction.findById(auction._id);
    console.log(`  Initial price: ₹5000 | Final Highest Bid: ₹${finalAuction.currentHighestBid}`);
    console.log(`  Total bids in bids[]: ${finalAuction.bids.length}`);

    // All 4 bids should be accepted sequentially (5500, 6000, 6500, 7000)
    assert.strictEqual(fulfilled.length, 4, `All 4 concurrent increment bids must succeed, got ${fulfilled.length}`);
    assert.strictEqual(finalAuction.currentHighestBid, 7000, `Final highest bid must be ₹7000, got ${finalAuction.currentHighestBid}`);
    assert.strictEqual(finalAuction.bids.length, 4, `bids[] must contain 4 entries, got ${finalAuction.bids.length}`);

    console.log('✅ TEST PASSED: All 4 concurrent increase bid requests processed sequentially without race condition failure!\n');

  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB Disconnected.');
  }
}

runTests();
