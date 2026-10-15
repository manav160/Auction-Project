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
const Transaction = require('../models/Transaction');
const LedgerEntry = require('../models/LedgerEntry');
const Participation = require('../models/Participation');
const AuctionService = require('../services/auctionService');
const WalletService = require('../services/walletService');
const BiddingService = require('../services/biddingService');
const PlatformSettingsService = require('../services/platformSettingsService');

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

async function createTestUser(name, initialBalance = 15000) {
  const user = await User.create({
    name,
    email: `${Date.now()}_${Math.random().toString(36).slice(2)}@bidtest.com`,
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

async function createTestAuction(sellerId, opts = {}) {
  const {
    startingPrice = 5000,
    currentHighestBid = 5000,
    buyNowPrice = null,
    winnerId = null,
    bidIncrementOptions = [100, 500, 1000],
    endDate = new Date(Date.now() + 86400000) // +24h
  } = opts;

  return await Auction.create({
    title: 'Bid Concurrency Test Item',
    description: 'Item for bid concurrency test',
    startingPrice,
    currentHighestBid,
    buyNowPrice,
    sellerId,
    winnerId,
    bidIncrementOptions,
    endDate,
    status: 'ACTIVE'
  });
}

async function addParticipant(auctionId, userId) {
  try {
    await Participation.create({ auctionId, userId, entryFeePaid: 0 });
  } catch (e) {
    if (e.code === 11000 && e.message.includes('auctionId_1_userId_1')) {
      // Ignore true duplicate participation
      return;
    }
    console.error(`[addParticipant FAILED] user ${userId}:`, e.message);
    throw e;
  }
}

/**
 * Run placeBid concurrently for multiple users, returning settled outcomes.
 */
async function placeBidsConcurrently(auctionId, bids) {
  const promises = bids.map(({ userId, amount }) =>
    BiddingService.placeBid({ auctionId, userId, amount })
      .then(result => ({ status: 'fulfilled', value: result, userId, amount }))
      .catch(err => ({ status: 'rejected', reason: err, userId, amount }))
  );
  return Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Test Runner
// ---------------------------------------------------------------------------

async function runTests() {
  console.log('Connecting to MongoDB for Bid Concurrency Test Suite...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB Connected.\n');

  // Drop stale legacy indexes on participations if present
  try {
    await Participation.syncIndexes();
  } catch (e) {
    console.log('Participation index sync:', e.message);
  }

  await PlatformSettingsService.getSettings();

  const results = [];

  async function testWrapper(testNum, title, testFn) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`TEST ${testNum}: ${title}`);
      console.log(`${'='.repeat(60)}`);
      await testFn();
      console.log(`✅ TEST ${testNum} PASSED: ${title}`);
      results.push({ testNum, title, status: 'PASSED' });
    } catch (err) {
      console.error(`❌ TEST ${testNum} FAILED: ${title}`);
      console.error(`   Error: ${err.message}`);
      results.push({ testNum, title, status: 'FAILED', error: err.message });
    }
  }

  // =========================================================================
  // CASE 1: A→₹6,000 and B→₹7,000 concurrently. Expected: highest=₹7,000, winner=B
  // =========================================================================
  await testWrapper(1, 'Two concurrent bids — higher bid wins regardless of order', async () => {
    const seller = await createTestUser('Seller_C1', 50000);
    const userA = await createTestUser('UserA_C1', 50000);
    const userB = await createTestUser('UserB_C1', 50000);
    const auction = await createTestAuction(seller._id);

    await addParticipant(auction._id, userA._id);
    await addParticipant(auction._id, userB._id);

    const outcomes = await placeBidsConcurrently(auction._id, [
      { userId: userA._id, amount: 6000 },
      { userId: userB._id, amount: 7000 }
    ]);

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    const rejected = outcomes.filter(o => o.status === 'rejected');
    console.log(`  Fulfilled: ${fulfilled.length}, Rejected: ${rejected.length}`);
    for (const r of rejected) {
      console.log(`    Rejected bid ₹${r.amount} for user ${r.userId}: ${r.reason?.message}`);
    }

    const final = await Auction.findById(auction._id);
    assert.strictEqual(final.currentHighestBid, 7000, `Expected highest=7000, got ${final.currentHighestBid}`);
    assert.strictEqual(final.winnerId.toString(), userB._id.toString(), 'Winner must be User B');
  });

  // =========================================================================
  // CASE 2: A→₹7,000 and B→₹6,000 concurrently. Expected: highest=₹7,000, winner=A
  // =========================================================================
  await testWrapper(2, 'Two concurrent bids — higher bid wins (reversed order)', async () => {
    const seller = await createTestUser('Seller_C2', 50000);
    const userA = await createTestUser('UserA_C2', 50000);
    const userB = await createTestUser('UserB_C2', 50000);
    const auction = await createTestAuction(seller._id);

    await addParticipant(auction._id, userA._id);
    await addParticipant(auction._id, userB._id);

    const outcomes = await placeBidsConcurrently(auction._id, [
      { userId: userA._id, amount: 7000 },
      { userId: userB._id, amount: 6000 }
    ]);

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    console.log(`  Fulfilled: ${fulfilled.length}, Rejected: ${outcomes.length - fulfilled.length}`);

    const final = await Auction.findById(auction._id);
    assert.strictEqual(final.currentHighestBid, 7000, `Expected highest=7000, got ${final.currentHighestBid}`);
    assert.strictEqual(final.winnerId.toString(), userA._id.toString(), 'Winner must be User A');
  });

  // =========================================================================
  // CASE 3: A→₹6K, B→₹6.5K, C→₹7K, D→₹8K simultaneous. Expected: highest=₹8K, winner=D
  // =========================================================================
  await testWrapper(3, 'Four concurrent bids — highest wins', async () => {
    const seller = await createTestUser('Seller_C3', 50000);
    const users = [];
    for (let i = 0; i < 4; i++) {
      users.push(await createTestUser(`User${i}_C3`, 50000));
    }
    const auction = await createTestAuction(seller._id);
    for (const u of users) await addParticipant(auction._id, u._id);

    const outcomes = await placeBidsConcurrently(auction._id, [
      { userId: users[0]._id, amount: 6000 },
      { userId: users[1]._id, amount: 6500 },
      { userId: users[2]._id, amount: 7000 },
      { userId: users[3]._id, amount: 8000 }
    ]);

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    const rejected = outcomes.filter(o => o.status === 'rejected');
    console.log(`  Fulfilled: ${fulfilled.length}, Rejected: ${rejected.length}`);
    for (const r of rejected) {
      console.log(`    Rejected bid ₹${r.amount} for user ${r.userId}: ${r.reason?.message}`);
    }

    const final = await Auction.findById(auction._id);
    assert.strictEqual(final.currentHighestBid, 8000, `Expected highest=8000, got ${final.currentHighestBid}`);
    assert.strictEqual(final.winnerId.toString(), users[3]._id.toString(), 'Winner must be User D (index 3)');
  });

  // =========================================================================
  // CASE 4: 10 users submit different valid bids simultaneously
  // =========================================================================
  await testWrapper(4, '10 simultaneous different bids — maximum wins', async () => {
    const seller = await createTestUser('Seller_C4', 50000);
    const users = [];
    const amounts = [];
    for (let i = 0; i < 10; i++) {
      users.push(await createTestUser(`User${i}_C4`, 50000));
      amounts.push(5100 + (i * 500)); // 5100, 5600, 6100, ..., 9600
    }
    const auction = await createTestAuction(seller._id);
    for (const u of users) await addParticipant(auction._id, u._id);

    const bids = users.map((u, i) => ({ userId: u._id, amount: amounts[i] }));
    const outcomes = await placeBidsConcurrently(auction._id, bids);

    const maxAmount = Math.max(...amounts);
    const expectedWinnerIdx = amounts.indexOf(maxAmount);

    const final = await Auction.findById(auction._id);
    assert.strictEqual(final.currentHighestBid, maxAmount, `Expected highest=${maxAmount}, got ${final.currentHighestBid}`);
    assert.strictEqual(
      final.winnerId.toString(),
      users[expectedWinnerIdx]._id.toString(),
      `Winner must be user with bid ₹${maxAmount}`
    );

    // Verify bids[] is consistent
    const highestBidEntry = final.bids.find(b => b.amount === maxAmount);
    assert.ok(highestBidEntry, `bids[] must contain the winning amount ₹${maxAmount}`);
    assert.strictEqual(
      highestBidEntry.userId.toString(),
      users[expectedWinnerIdx]._id.toString(),
      'bids[] winning entry userId must match winnerId'
    );

    console.log(`  Final highest: ₹${final.currentHighestBid}, Winner: User index ${expectedWinnerIdx}`);
  });

  // =========================================================================
  // CASE 5: Two users submit exactly the same bid simultaneously
  //         Tie-breaking: first accepted wins ($lt rejects equal amounts)
  // =========================================================================
  await testWrapper(5, 'Two equal bids — first-accepted-wins tie-breaking', async () => {
    const seller = await createTestUser('Seller_C5', 50000);
    const userA = await createTestUser('UserA_C5', 50000);
    const userB = await createTestUser('UserB_C5', 50000);
    const auction = await createTestAuction(seller._id);

    await addParticipant(auction._id, userA._id);
    await addParticipant(auction._id, userB._id);

    const outcomes = await placeBidsConcurrently(auction._id, [
      { userId: userA._id, amount: 7000 },
      { userId: userB._id, amount: 7000 }
    ]);

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    const rejected = outcomes.filter(o => o.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, `Exactly 1 bid must succeed for equal amounts, got ${fulfilled.length}`);
    assert.strictEqual(rejected.length, 1, `Exactly 1 bid must be rejected for equal amounts, got ${rejected.length}`);

    const final = await Auction.findById(auction._id);
    assert.strictEqual(final.currentHighestBid, 7000, `Highest must be 7000`);
    assert.strictEqual(
      final.winnerId.toString(),
      fulfilled[0].userId.toString(),
      'Winner must be the user whose bid was accepted first'
    );
    console.log(`  Winner: ${fulfilled[0].userId} (first-accepted-wins)`);
  });

  // =========================================================================
  // CASE 6: 10 users submit exactly the same bid simultaneously
  // =========================================================================
  await testWrapper(6, '10 equal bids — exactly one deterministic winner', async () => {
    const seller = await createTestUser('Seller_C6', 50000);
    const users = [];
    for (let i = 0; i < 10; i++) {
      users.push(await createTestUser(`User${i}_C6`, 50000));
    }
    const auction = await createTestAuction(seller._id);
    for (const u of users) await addParticipant(auction._id, u._id);

    const bids = users.map(u => ({ userId: u._id, amount: 7000 }));
    const outcomes = await placeBidsConcurrently(auction._id, bids);

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    const rejected = outcomes.filter(o => o.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, `Exactly 1 winner expected for 10 equal bids, got ${fulfilled.length}`);
    assert.strictEqual(rejected.length, 9, `9 rejections expected for 10 equal bids, got ${rejected.length}`);

    const final = await Auction.findById(auction._id);
    assert.strictEqual(final.currentHighestBid, 7000);
    assert.strictEqual(
      final.winnerId.toString(),
      fulfilled[0].userId.toString(),
      'Winner must be the single accepted bidder'
    );

    // Verify only 1 bid entry in bids[]
    const bidsAtAmount = final.bids.filter(b => b.amount === 7000);
    assert.strictEqual(bidsAtAmount.length, 1, `bids[] must contain exactly 1 entry at ₹7000, got ${bidsAtAmount.length}`);

    console.log(`  Winner: ${fulfilled[0].userId} (only 1 of 10 equal bids accepted)`);
  });

  // =========================================================================
  // CASE 7: Same bid request sent twice with same idempotency key
  // =========================================================================
  await testWrapper(7, 'Duplicate bid with same idempotency key — no double lock', async () => {
    const seller = await createTestUser('Seller_C7', 50000);
    const user = await createTestUser('User_C7', 50000);
    const auction = await createTestAuction(seller._id);
    await addParticipant(auction._id, user._id);

    const idemKey = `test-idem-${Date.now()}-${Math.random()}`;

    // First bid
    const result1 = await BiddingService.placeBid({
      auctionId: auction._id,
      userId: user._id,
      amount: 6000,
      idempotencyKey: idemKey
    });

    // Retry with same key
    const result2 = await BiddingService.placeBid({
      auctionId: auction._id,
      userId: user._id,
      amount: 6000,
      idempotencyKey: idemKey
    });

    // Verify only 1 transaction record
    const txCount = await Transaction.countDocuments({ idempotencyKey: idemKey });
    assert.strictEqual(txCount, 1, `Expected 1 transaction, got ${txCount}`);

    // Verify wallet was only locked once
    const wallet = await Wallet.findOne({ userId: user._id });
    assert.strictEqual(wallet.lockedBalance, 6000, `Locked must be 6000 (not 12000), got ${wallet.lockedBalance}`);
    assert.strictEqual(wallet.availableBalance, 44000, `Available must be 44000, got ${wallet.availableBalance}`);

    console.log(`  Wallet: available=${wallet.availableBalance}, locked=${wallet.lockedBalance}`);
  });

  // =========================================================================
  // CASE 8: Current highest bidder is outbid — refund exactly once
  // =========================================================================
  await testWrapper(8, 'Outbid refund — previous bidder money returned exactly once', async () => {
    const seller = await createTestUser('Seller_C8', 50000);
    const userA = await createTestUser('UserA_C8', 50000);
    const userB = await createTestUser('UserB_C8', 50000);
    const auction = await createTestAuction(seller._id);

    await addParticipant(auction._id, userA._id);
    await addParticipant(auction._id, userB._id);

    // User A bids first
    await BiddingService.placeBid({
      auctionId: auction._id,
      userId: userA._id,
      amount: 6000
    });

    const walletAAfterBid = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(walletAAfterBid.availableBalance, 44000, 'A available after bid must be 44000');
    assert.strictEqual(walletAAfterBid.lockedBalance, 6000, 'A locked after bid must be 6000');

    // User B outbids
    await BiddingService.placeBid({
      auctionId: auction._id,
      userId: userB._id,
      amount: 7000
    });

    // A should be refunded
    const walletAAfterOutbid = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(walletAAfterOutbid.availableBalance, 50000, 'A available after outbid must be 50000 (refunded)');
    assert.strictEqual(walletAAfterOutbid.lockedBalance, 0, 'A locked after outbid must be 0');

    // B should have locked funds
    const walletB = await Wallet.findOne({ userId: userB._id });
    assert.strictEqual(walletB.lockedBalance, 7000, 'B locked must be 7000');
    assert.strictEqual(walletB.availableBalance, 43000, 'B available must be 43000');

    // Verify refund transaction exists exactly once
    const refundKey = `outbid-refund-${auction._id}-${userA._id}-6000`;
    const refundTxCount = await Transaction.countDocuments({ idempotencyKey: refundKey });
    assert.strictEqual(refundTxCount, 1, `Expected exactly 1 refund transaction, got ${refundTxCount}`);

    console.log(`  A: available=${walletAAfterOutbid.availableBalance}, locked=${walletAAfterOutbid.lockedBalance}`);
    console.log(`  B: available=${walletB.availableBalance}, locked=${walletB.lockedBalance}`);
  });

  // =========================================================================
  // CASE 9: Bid and auction finalization happen concurrently
  // =========================================================================
  await testWrapper(9, 'Bid vs finalization race — deterministic final state', async () => {
    const seller = await createTestUser('Seller_C9', 50000);
    const userA = await createTestUser('UserA_C9', 50000);
    const userB = await createTestUser('UserB_C9', 50000);
    const auction = await createTestAuction(seller._id);

    await addParticipant(auction._id, userA._id);
    await addParticipant(auction._id, userB._id);

    // Place an initial bid
    await BiddingService.placeBid({
      auctionId: auction._id,
      userId: userA._id,
      amount: 6000
    });

    // Now race: B tries to bid at the same time as finalization
    const bidPromise = BiddingService.placeBid({
      auctionId: auction._id,
      userId: userB._id,
      amount: 7000
    }).then(r => ({ status: 'fulfilled', value: r }))
      .catch(e => ({ status: 'rejected', reason: e }));

    const finalizePromise = AuctionService.transitionToPendingResolution(auction._id)
      .then(r => ({ status: 'fulfilled', value: r }))
      .catch(e => ({ status: 'rejected', reason: e }));

    const [bidResult, finResult] = await Promise.all([bidPromise, finalizePromise]);

    const final = await Auction.findById(auction._id);
    console.log(`  Bid result: ${bidResult.status}, Finalize result: ${finResult.status}`);
    console.log(`  Final status: ${final.status}, highest: ${final.currentHighestBid}, winner: ${final.winnerId}`);

    // Deterministic: either bid succeeded (and finalization sees the updated state),
    // or finalization happened first (and the bid was rejected because status != ACTIVE)
    if (bidResult.status === 'fulfilled') {
      // B's bid was accepted before finalization
      assert.strictEqual(final.currentHighestBid, 7000, 'If bid succeeded, highest must be 7000');
      // Status could be PENDING_RESOLUTION (finalization transitioned after bid)
      // or ACTIVE (finalization failed because status check happened before transition)
    } else {
      // Finalization happened first, bid was rejected
      assert.ok(
        ['PENDING_RESOLUTION', 'COMPLETED', 'UNSOLD'].includes(final.status),
        `Status must reflect finalization: ${final.status}`
      );
    }

    // Critical invariant: the bid must NOT have been accepted after finalization
    if (final.status !== 'ACTIVE') {
      // If auction is finalized, check that the state is consistent
      const lastAcceptedBid = final.bids.length > 0
        ? Math.max(...final.bids.map(b => b.amount))
        : final.startingPrice;
      assert.strictEqual(
        final.currentHighestBid, lastAcceptedBid,
        `currentHighestBid (${final.currentHighestBid}) must match highest bid in bids[] (${lastAcceptedBid})`
      );
    }
  });

  // =========================================================================
  // CASE 10: 10 simultaneous bidders + wallet integrity
  // =========================================================================
  await testWrapper(10, '10 simultaneous bidders — no negative wallets, no duplicate locks/refunds', async () => {
    const seller = await createTestUser('Seller_C10', 50000);
    const users = [];
    const initialBalance = 50000;
    for (let i = 0; i < 10; i++) {
      users.push(await createTestUser(`User${i}_C10`, initialBalance));
    }
    const auction = await createTestAuction(seller._id);
    for (const u of users) await addParticipant(auction._id, u._id);

    const amounts = [5200, 5500, 5800, 6100, 6500, 7000, 7500, 8000, 8500, 9000];
    const bids = users.map((u, i) => ({ userId: u._id, amount: amounts[i] }));

    const outcomes = await placeBidsConcurrently(auction._id, bids);

    const final = await Auction.findById(auction._id);
    const maxAmount = Math.max(...amounts);
    const winnerIdx = amounts.indexOf(maxAmount);

    assert.strictEqual(final.currentHighestBid, maxAmount, `Highest must be ${maxAmount}`);
    assert.strictEqual(
      final.winnerId.toString(),
      users[winnerIdx]._id.toString(),
      `Winner must be user with ₹${maxAmount}`
    );

    // Verify ALL wallets have non-negative balances
    for (let i = 0; i < users.length; i++) {
      const wallet = await Wallet.findOne({ userId: users[i]._id });
      assert.ok(wallet.availableBalance >= 0,
        `User ${i} availableBalance must be >= 0, got ${wallet.availableBalance}`);
      assert.ok(wallet.lockedBalance >= 0,
        `User ${i} lockedBalance must be >= 0, got ${wallet.lockedBalance}`);

      if (users[i]._id.toString() === final.winnerId.toString()) {
        // Winner: funds should be locked
        assert.strictEqual(wallet.lockedBalance, maxAmount,
          `Winner locked must be ${maxAmount}, got ${wallet.lockedBalance}`);
        assert.strictEqual(wallet.availableBalance, initialBalance - maxAmount,
          `Winner available must be ${initialBalance - maxAmount}, got ${wallet.availableBalance}`);
      } else {
        // Non-winners: all funds should be returned (if their bid was ever accepted then later refunded,
        // or never accepted in the first place)
        const totalBalance = wallet.availableBalance + wallet.lockedBalance;
        assert.strictEqual(totalBalance, initialBalance,
          `Non-winner ${i} total balance must be ${initialBalance}, got ${totalBalance}`);
      }
    }

    // Verify no duplicate refund transactions
    const refundTxs = await Transaction.find({
      referenceType: 'REFUND',
      referenceId: auction._id
    });
    const refundKeys = refundTxs.map(t => t.idempotencyKey);
    const uniqueKeys = new Set(refundKeys);
    assert.strictEqual(refundKeys.length, uniqueKeys.size,
      `No duplicate refund transactions allowed. Found ${refundKeys.length} with ${uniqueKeys.size} unique keys`);

    console.log(`  Final: highest=₹${final.currentHighestBid}, winner=User${winnerIdx}`);
    console.log(`  Total bid entries: ${final.bids.length}`);
    console.log(`  Total refund transactions: ${refundTxs.length}`);
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log(`\n${'='.repeat(60)}`);
  console.log('BID CONCURRENCY TEST SUITE — SUMMARY');
  console.log(`${'='.repeat(60)}`);

  const total = results.length;
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;

  for (const r of results) {
    const icon = r.status === 'PASSED' ? '✅' : '❌';
    console.log(`  ${icon} Case ${r.testNum}: ${r.title}`);
    if (r.error) console.log(`     └─ ${r.error}`);
  }

  console.log(`\n  Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`${'='.repeat(60)}`);

  await mongoose.disconnect();
  console.log('MongoDB Disconnected.');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal error running bid concurrency test suite:', err);
  process.exit(1);
});
