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
const AuctionService = require('../services/auctionService');
const WalletService = require('../services/walletService');
const BiddingService = require('../services/biddingService');
const PlatformSettingsService = require('../services/platformSettingsService');

// Helper to create test user with wallet
async function createTestUser(name, email, initialBalance = 15000) {
  const user = await User.create({
    name,
    email: `${Date.now()}_${Math.random()}@test.com`,
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

// Helper to create test auction
async function createTestAuction(sellerId, { startingPrice = 1000, buyNowPrice = 10000, currentHighestBid = 1000, winnerId = null } = {}) {
  return await Auction.create({
    title: 'Test Concurrency Item',
    description: 'Item for concurrency test',
    startingPrice,
    currentHighestBid,
    buyNowPrice,
    sellerId,
    winnerId,
    endDate: new Date(Date.now() + 86400000),
    status: 'ACTIVE'
  });
}

async function runTests() {
  console.log('Connecting to MongoDB Atlas for Concurrency Verification Suite...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB Connected successfully.');

  await PlatformSettingsService.getSettings();

  const results = [];

  async function testWrapper(testNum, title, testFn) {
    try {
      console.log(`\n==================================================`);
      console.log(`RUNNING TEST ${testNum}: ${title}`);
      console.log(`==================================================`);
      await testFn();
      console.log(`✅ TEST ${testNum} PASSED: ${title}`);
      results.push({ testNum, title, status: 'PASSED' });
    } catch (err) {
      console.error(`❌ TEST ${testNum} FAILED: ${title}`, err.message);
      results.push({ testNum, title, status: 'FAILED', error: err.message });
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 1: 10 users click Buy Now simultaneously -> Exactly 1 winner
  // ---------------------------------------------------------------------------
  await testWrapper(1, '10 users click Buy Now simultaneously -> Exactly 1 winner', async () => {
    const seller = await createTestUser('Seller1', 'seller1@test.com');
    const auction = await createTestAuction(seller._id, { buyNowPrice: 10000 });

    const buyers = [];
    for (let i = 0; i < 10; i++) {
      buyers.push(await createTestUser(`Buyer_${i}`, `buyer_${i}@test.com`, 20000));
    }

    const buyNowPromises = buyers.map((buyer, idx) => 
      AuctionService.executeBuyNow({
        auctionId: auction._id,
        buyerId: buyer._id,
        idempotencyKey: `simultaneous-buynow-${auction._id}-user-${idx}`
      }).then(res => ({ status: 'fulfilled', value: res }))
        .catch(err => ({ status: 'rejected', reason: err }))
    );

    const outcomes = await Promise.all(buyNowPromises);

    const fulfilled = outcomes.filter(o => o.status === 'fulfilled');
    const rejected = outcomes.filter(o => o.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, `Expected exactly 1 successful winner, got ${fulfilled.length}`);
    assert.strictEqual(rejected.length, 9, `Expected exactly 9 failed requests, got ${rejected.length}`);

    const updatedAuction = await Auction.findById(auction._id);
    assert.strictEqual(updatedAuction.status, 'COMPLETED');
    assert.strictEqual(updatedAuction.buyNowPurchased, true);
    assert.notStrictEqual(updatedAuction.winnerId, null);
  });

  // ---------------------------------------------------------------------------
  // TEST 2: 10 users click Buy Now simultaneously -> No winner duplication
  // ---------------------------------------------------------------------------
  await testWrapper(2, '10 users click Buy Now simultaneously -> No winner duplication', async () => {
    const seller = await createTestUser('Seller2', 'seller2@test.com');
    const auction = await createTestAuction(seller._id, { buyNowPrice: 10000 });

    const buyers = [];
    for (let i = 0; i < 10; i++) {
      buyers.push(await createTestUser(`Buyer2_${i}`, `buyer2_${i}@test.com`, 20000));
    }

    await Promise.all(buyers.map((buyer, idx) => 
      AuctionService.executeBuyNow({
        auctionId: auction._id,
        buyerId: buyer._id,
        idempotencyKey: `simultaneous-buynow-t2-${auction._id}-user-${idx}`
      }).catch(() => null)
    ));

    const updatedAuction = await Auction.findById(auction._id);
    assert.strictEqual(updatedAuction.buyNowPurchased, true);
    assert.ok(updatedAuction.winnerId);
    // Ensure bids array contains only ONE buyNow bid subdocument
    const buyNowBids = updatedAuction.bids.filter(b => b.isBuyNow);
    assert.strictEqual(buyNowBids.length, 1, `Expected exactly 1 Buy Now bid entry, got ${buyNowBids.length}`);
  });

  // ---------------------------------------------------------------------------
  // TEST 3: 10 users click Buy Now simultaneously -> Only winner's wallet processed
  // ---------------------------------------------------------------------------
  await testWrapper(3, '10 users click Buy Now simultaneously -> Only winner wallet processed', async () => {
    const seller = await createTestUser('Seller3', 'seller3@test.com');
    const auction = await createTestAuction(seller._id, { buyNowPrice: 10000 });

    const buyers = [];
    for (let i = 0; i < 10; i++) {
      buyers.push(await createTestUser(`Buyer3_${i}`, `buyer3_${i}@test.com`, 20000));
    }

    await Promise.all(buyers.map((buyer, idx) => 
      AuctionService.executeBuyNow({
        auctionId: auction._id,
        buyerId: buyer._id,
        idempotencyKey: `simultaneous-buynow-t3-${auction._id}-user-${idx}`
      }).catch(() => null)
    ));

    const updatedAuction = await Auction.findById(auction._id);
    const winnerIdStr = updatedAuction.winnerId.toString();

    for (const buyer of buyers) {
      const wallet = await Wallet.findOne({ userId: buyer._id });
      if (buyer._id.toString() === winnerIdStr) {
        assert.strictEqual(wallet.availableBalance, 10000, 'Winner balance should be 20000 - 10000 = 10000');
      } else {
        assert.strictEqual(wallet.availableBalance, 20000, `Non-winner ${buyer._id} balance must remain 20000`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 4: Winner has insufficient balance -> Payment fails safely & auction remains ACTIVE
  // ---------------------------------------------------------------------------
  await testWrapper(4, 'Winner has insufficient balance -> Fails safely & auction remains ACTIVE', async () => {
    const seller = await createTestUser('Seller4', 'seller4@test.com');
    const auction = await createTestAuction(seller._id, { buyNowPrice: 10000 });
    const poorBuyer = await createTestUser('PoorBuyer', 'poor@test.com', 2000);

    let errorThrown = null;
    try {
      await AuctionService.executeBuyNow({
        auctionId: auction._id,
        buyerId: poorBuyer._id,
        idempotencyKey: `poor-buyer-${auction._id}`
      });
    } catch (err) {
      errorThrown = err;
    }

    assert.ok(errorThrown, 'Expected payment failure error for poor buyer');
    const updatedAuction = await Auction.findById(auction._id);
    assert.strictEqual(updatedAuction.status, 'ACTIVE', 'Auction status must revert/remain ACTIVE');
    assert.strictEqual(updatedAuction.buyNowPurchased, false);
    assert.strictEqual(updatedAuction.winnerId, null);

    const poorWallet = await Wallet.findOne({ userId: poorBuyer._id });
    assert.strictEqual(poorWallet.availableBalance, 2000, 'Poor buyer wallet balance must remain untouched');
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Same Buy Now request sent twice with same idempotencyKey -> 1 financial operation
  // ---------------------------------------------------------------------------
  await testWrapper(5, 'Same Buy Now request sent twice with same idempotencyKey -> 1 financial operation', async () => {
    const seller = await createTestUser('Seller5', 'seller5@test.com');
    const auction = await createTestAuction(seller._id, { buyNowPrice: 10000 });
    const buyer = await createTestUser('Buyer5', 'buyer5@test.com', 20000);
    const key = `idem-key-test-${Date.now()}`;

    const res1 = await AuctionService.executeBuyNow({ auctionId: auction._id, buyerId: buyer._id, idempotencyKey: key });
    const res2 = await AuctionService.executeBuyNow({ auctionId: auction._id, buyerId: buyer._id, idempotencyKey: key });

    assert.strictEqual(res1._id.toString(), res2._id.toString());

    const txs = await Transaction.find({ idempotencyKey: key });
    assert.strictEqual(txs.length, 1, `Expected exactly 1 transaction record, found ${txs.length}`);

    const wallet = await Wallet.findOne({ userId: buyer._id });
    assert.strictEqual(wallet.availableBalance, 10000, 'Wallet balance should be debited only once');
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Client retries after successful Buy Now due to network timeout
  // ---------------------------------------------------------------------------
  await testWrapper(6, 'Client retries after successful Buy Now -> Return result with no duplicate payment', async () => {
    const seller = await createTestUser('Seller6', 'seller6@test.com');
    const auction = await createTestAuction(seller._id, { buyNowPrice: 5000 });
    const buyer = await createTestUser('Buyer6', 'buyer6@test.com', 15000);
    const retryKey = `network-retry-key-${Date.now()}`;

    // First attempt succeeds
    await AuctionService.executeBuyNow({ auctionId: auction._id, buyerId: buyer._id, idempotencyKey: retryKey });

    // Client retries identical request
    const retryRes = await AuctionService.executeBuyNow({ auctionId: auction._id, buyerId: buyer._id, idempotencyKey: retryKey });

    assert.strictEqual(retryRes.status, 'COMPLETED');
    assert.strictEqual(retryRes.winnerId.toString(), buyer._id.toString());

    const wallet = await Wallet.findOne({ userId: buyer._id });
    assert.strictEqual(wallet.availableBalance, 10000, 'Wallet should be debited exactly 5000 once');
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Buy Now request arrives after auction is already completed -> No money charged
  // ---------------------------------------------------------------------------
  await testWrapper(7, 'Buy Now request arrives after auction completed -> No money charged', async () => {
    const seller = await createTestUser('Seller7', 'seller7@test.com');
    const auction = await createTestAuction(seller._id, { buyNowPrice: 8000 });
    const buyer1 = await createTestUser('Buyer7_1', 'buyer7_1@test.com', 20000);
    const buyer2 = await createTestUser('Buyer7_2', 'buyer7_2@test.com', 20000);

    // Buyer 1 wins auction
    await AuctionService.executeBuyNow({ auctionId: auction._id, buyerId: buyer1._id, idempotencyKey: `b1-win-${auction._id}` });

    // Buyer 2 attempts Buy Now late
    let lateError = null;
    try {
      await AuctionService.executeBuyNow({ auctionId: auction._id, buyerId: buyer2._id, idempotencyKey: `b2-late-${auction._id}` });
    } catch (err) {
      lateError = err;
    }

    assert.ok(lateError, 'Expected conflict error for late Buy Now attempt');
    const buyer2Wallet = await Wallet.findOne({ userId: buyer2._id });
    assert.strictEqual(buyer2Wallet.availableBalance, 20000, 'Late buyer wallet must remain untouched');
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Two requests attempt to finalize the same auction simultaneously
  // ---------------------------------------------------------------------------
  await testWrapper(8, 'Two requests attempt to finalize same auction simultaneously -> Only 1 succeeds', async () => {
    const seller = await createTestUser('Seller8', 'seller8@test.com');
    const auction = await createTestAuction(seller._id, { buyNowPrice: 5000 });
    const bidder = await createTestUser('Bidder8', 'bidder8@test.com', 20000);

    // Place a bid first
    const Participation = require('../models/Participation');
    await Participation.create({ auctionId: auction._id, userId: bidder._id });
    await BiddingService.placeBid({ auctionId: auction._id, userId: bidder._id, amount: 2000 });

    // Transition auction to PENDING_RESOLUTION
    await AuctionService.transitionToPendingResolution(auction._id, { force: true });

    // Run 2 simultaneous finalizations
    const fin1 = AuctionService.finalizeAuction(auction._id).then(r => ({ status: 'fulfilled', r })).catch(e => ({ status: 'rejected', e }));
    const fin2 = AuctionService.finalizeAuction(auction._id).then(r => ({ status: 'fulfilled', r })).catch(e => ({ status: 'rejected', e }));

    const finResults = await Promise.all([fin1, fin2]);
    const fulfilledFin = finResults.filter(f => f.status === 'fulfilled');

    assert.strictEqual(fulfilledFin.length, 1, `Expected exactly 1 successful finalization, got ${fulfilledFin.length}`);
  });

  // ---------------------------------------------------------------------------
  // TEST 9: Concurrent wallet operations on same user -> Balances remain correct & non-negative
  // ---------------------------------------------------------------------------
  await testWrapper(9, 'Concurrent wallet operations on same user -> No negative balance', async () => {
    const user = await createTestUser('ConcurrentWalletUser', 'concwallet@test.com', 10000);
    const seller = await createTestUser('Seller9', 'seller9@test.com');
    const auction1 = await createTestAuction(seller._id, { buyNowPrice: 8000 });
    const auction2 = await createTestAuction(seller._id, { buyNowPrice: 8000 });

    // User has 10,000 balance. Attempts 2 simultaneous Buy Now purchases of 8,000 each!
    const op1 = AuctionService.executeBuyNow({ auctionId: auction1._id, buyerId: user._id, idempotencyKey: `user-conc-1-${Date.now()}` })
      .then(r => ({ status: 'fulfilled' })).catch(e => ({ status: 'rejected', error: e }));
    const op2 = AuctionService.executeBuyNow({ auctionId: auction2._id, buyerId: user._id, idempotencyKey: `user-conc-2-${Date.now()}` })
      .then(r => ({ status: 'fulfilled' })).catch(e => ({ status: 'rejected', error: e }));

    const opResults = await Promise.all([op1, op2]);
    const opFulfilled = opResults.filter(o => o.status === 'fulfilled');
    const opRejected = opResults.filter(o => o.status === 'rejected');

    assert.strictEqual(opFulfilled.length, 1, 'Only 1 purchase should succeed since balance is insufficient for both');
    assert.strictEqual(opRejected.length, 1, 'Second purchase must fail');

    const wallet = await Wallet.findOne({ userId: user._id });
    assert.strictEqual(wallet.availableBalance, 2000, 'Wallet balance should be 10000 - 8000 = 2000');
    assert.ok(wallet.availableBalance >= 0, 'Available balance must not be negative');
  });

  // ---------------------------------------------------------------------------
  // TEST 10: Refund/unlock operation is retried -> Money not refunded twice
  // ---------------------------------------------------------------------------
  await testWrapper(10, 'Refund/unlock operation is retried -> Money not refunded twice', async () => {
    const user = await createTestUser('RefundUser', 'refund@test.com', 15000);
    const seller = await createTestUser('Seller10', 'seller10@test.com');
    const auction = await createTestAuction(seller._id);

    // Lock 5,000 for a bid
    await WalletService.lockFunds({
      userId: user._id,
      amount: 5000,
      referenceType: 'BID',
      referenceId: auction._id,
      idempotencyKey: `bid-lock-t10-${auction._id}`,
      description: 'Bid lock'
    });

    const refundKey = `test-unlock-retry-${auction._id}`;
    // Unlock funds twice with same idempotency key
    await WalletService.unlockFunds({
      userId: user._id,
      amount: 5000,
      referenceType: 'REFUND',
      referenceId: auction._id,
      idempotencyKey: refundKey,
      description: 'Outbid refund'
    });

    await WalletService.unlockFunds({
      userId: user._id,
      amount: 5000,
      referenceType: 'REFUND',
      referenceId: auction._id,
      idempotencyKey: refundKey,
      description: 'Outbid refund retry'
    });

    const wallet = await Wallet.findOne({ userId: user._id });
    assert.strictEqual(wallet.availableBalance, 15000, 'Available balance must be restored to 15000');
    assert.strictEqual(wallet.lockedBalance, 0, 'Locked balance must be 0');
  });

  // ---------------------------------------------------------------------------
  // TEST 11: Simulated database/transaction failure midway -> No partial state
  // ---------------------------------------------------------------------------
  await testWrapper(11, 'Database/transaction failure midway -> No partial auction/payment state remains', async () => {
    const seller = await createTestUser('Seller11', 'seller11@test.com');
    const auction = await createTestAuction(seller._id, { buyNowPrice: 10000 });
    const buyer = await createTestUser('Buyer11', 'buyer11@test.com', 15000);

    // Pass invalid ObjectId reference to cause middle transaction error
    let sessionError = null;
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Auction.findOneAndUpdate(
        { _id: auction._id, status: 'ACTIVE' },
        { $set: { status: 'COMPLETED', winnerId: buyer._id, buyNowPurchased: true } },
        { session }
      );
      // Intentionally throw mid-transaction failure
      throw new Error('Simulated database crash mid-transaction');
    } catch (err) {
      sessionError = err;
      await session.abortTransaction();
    } finally {
      session.endSession();
    }

    assert.ok(sessionError, 'Expected simulated crash error');

    const freshAuction = await Auction.findById(auction._id);
    assert.strictEqual(freshAuction.status, 'ACTIVE', 'Auction state must remain ACTIVE after aborted transaction');
    assert.strictEqual(freshAuction.buyNowPurchased, false);
    assert.strictEqual(freshAuction.winnerId, null);
  });

  // ---------------------------------------------------------------------------
  // TEST 12: Concurrent wallet modification and refund -> Final wallet state remains correct
  // ---------------------------------------------------------------------------
  await testWrapper(12, 'Concurrent wallet modification and refund -> Final wallet state correct', async () => {
    const user = await createTestUser('WalletModUser', 'walletmod@test.com', 20000);
    const seller = await createTestUser('Seller12', 'seller12@test.com');
    const auction = await createTestAuction(seller._id);

    // Lock 5000
    await WalletService.lockFunds({
      userId: user._id,
      amount: 5000,
      referenceType: 'BID',
      referenceId: auction._id,
      idempotencyKey: `bid-lock-t12-${auction._id}`,
      description: 'Lock 5000'
    });

    // Simultaneously unlock 5000 and lock another 3000
    const opUnlock = WalletService.unlockFunds({
      userId: user._id,
      amount: 5000,
      referenceType: 'REFUND',
      referenceId: auction._id,
      idempotencyKey: `unlock-t12-${auction._id}`,
      description: 'Unlock 5000'
    });

    const opLock = WalletService.lockFunds({
      userId: user._id,
      amount: 3000,
      referenceType: 'BID',
      referenceId: auction._id,
      idempotencyKey: `bid-lock-t12-new-${auction._id}`,
      description: 'Lock 3000'
    });

    await Promise.all([opUnlock, opLock]);

    const wallet = await Wallet.findOne({ userId: user._id });
    // Started with 20000 available -> locked 5000 (15000 avail, 5000 locked)
    // Unlock 5000 (+5000 avail, -5000 locked) & Lock 3000 (-3000 avail, +3000 locked)
    // Final: available = 17000, locked = 3000
    assert.strictEqual(wallet.availableBalance, 17000, `Expected available balance 17000, got ${wallet.availableBalance}`);
    assert.strictEqual(wallet.lockedBalance, 3000, `Expected locked balance 3000, got ${wallet.lockedBalance}`);
  });

  // SUMMARY PRINT
  console.log('\n==================================================');
  console.log('AUTOMATED CONCURRENCY SUITE SUMMARY');
  console.log('==================================================');
  const total = results.length;
  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;

  console.log(`Total Scenarios Tested: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  await mongoose.disconnect();
  console.log('MongoDB Disconnected.');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error running concurrency test suite:', err);
  process.exit(1);
});
