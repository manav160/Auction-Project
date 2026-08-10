const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Participation = require('../models/Participation');
const WalletService = require('./walletService');
const Transaction = require('../models/Transaction');

class BiddingService {
  /**
   * Place a bid using an atomic conditional update with retry logic.
   *
   * Concurrency guarantees:
   * - findOneAndUpdate({ currentHighestBid: { $lt: amount } }) enforces that only
   *   a strictly higher bid can update the auction — at the database level.
   * - Equal bids: first-accepted-wins ($lt rejects equal amounts).
   * - bids[], currentHighestBid, and winnerId are updated in a single atomic op.
   * - WriteConflict (two transactions touching the same auction doc) is retried
   *   with exponential backoff. On retry, the auction state is re-read so the
   *   correct previousWinner is refunded.
   */

  static MAX_RETRIES = 5;

  /**
   * Public entry point. Performs idempotency check, static validations,
   * then delegates to the retryable transaction loop.
   */
  static async placeBid({ auctionId, userId, amount, idempotencyKey = null }) {
    // ---------------------------------------------------------------
    // IDEMPOTENCY CHECK — must come FIRST, before any validation
    // so that a retry of an already-committed bid returns immediately
    // even if the user is now the highest bidder.
    // ---------------------------------------------------------------
    const bidKey = idempotencyKey || `bid-lock-${auctionId}-${amount}-${userId}`;
    const existingTx = await Transaction.findOne({ idempotencyKey: bidKey });
    if (existingTx) {
      const currentAuction = await Auction.findById(auctionId);
      const existingBid = (currentAuction.bids || []).find(
        b => b.userId.toString() === userId.toString() && b.amount === amount
      );
      return {
        auction: currentAuction,
        bid: existingBid || currentAuction.bids[currentAuction.bids.length - 1]
      };
    }

    // ---------------------------------------------------------------
    // STATIC VALIDATIONS — these don't change between retries
    // ---------------------------------------------------------------
    const auctionSnapshot = await Auction.findById(auctionId).lean();
    if (!auctionSnapshot) {
      throw new Error('Auction not found');
    }
    if (auctionSnapshot.sellerId.toString() === userId.toString()) {
      throw new Error('You cannot bid on your own auction');
    }

    const participation = await Participation.findOne({
      auctionId: new mongoose.Types.ObjectId(String(auctionId)),
      userId: new mongoose.Types.ObjectId(String(userId))
    });
    if (!participation) {
      throw new Error('You must join the auction before placing a bid');
    }

    // ---------------------------------------------------------------
    // RETRY LOOP — handles WriteConflict / TransientTransactionError
    // When two bids hit the same auction document simultaneously inside
    // transactions, MongoDB aborts one with WriteConflict. The retry
    // re-reads the auction and re-evaluates with the latest state.
    // ---------------------------------------------------------------
    let lastError;
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this._executeBidTransaction({
          auctionId, userId, amount, bidKey,
          auctionTitle: auctionSnapshot.title
        });
      } catch (error) {
        lastError = error;

        if (this._isRetryableError(error) && attempt < this.MAX_RETRIES) {
          console.log(`[BiddingService Retry] Attempt ${attempt} failed with retryable error: ${error.message} (code: ${error.code})`);
          // Exponential backoff with jitter
          const delay = Math.min(50 * Math.pow(2, attempt), 500) + Math.random() * 50;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        console.log(`[BiddingService Error] Non-retryable or max retries reached: ${error.message} (code: ${error.code})`);
        throw error;
      }
    }
    throw lastError;
  }

  /**
   * Single transaction attempt. Reads auction state within the session,
   * locks the bidder's wallet, atomically updates the auction, refunds
   * the previous winner, and handles anti-snipe extension.
   */
  static async _executeBidTransaction({ auctionId, userId, amount, bidKey, auctionTitle }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ── Read current auction state within the transaction ──────────
      // This gives us snapshot-consistent previousWinner info.
      // If another transaction committed between our start and this read,
      // we'll get a WriteConflict when we try to update (which we retry).
      const currentAuction = await Auction.findById(auctionId).session(session);

      if (!currentAuction || currentAuction.status !== 'ACTIVE') {
        throw new Error('Auction is not active');
      }
      if (new Date(currentAuction.endDate) <= new Date()) {
        throw new Error('Auction has already ended');
      }
      if (currentAuction.winnerId && currentAuction.winnerId.toString() === userId.toString()) {
        throw new Error('You are already the highest bidder. Wait until someone outbids you.');
      }

      const minimumIncrement = Math.min(...(currentAuction.bidIncrementOptions || [100]));
      const minAllowedBid = currentAuction.currentHighestBid + minimumIncrement;
      if (amount < minAllowedBid) {
        throw new Error(`Bid must be at least ₹${minAllowedBid}`);
      }

      const previousWinnerId = currentAuction.winnerId;
      const previousAmount = currentAuction.currentHighestBid;

      // ── STEP 1: Lock the new bidder's funds ────────────────────────
      await WalletService.lockFunds({
        userId,
        amount,
        referenceType: 'BID',
        referenceId: currentAuction._id,
        idempotencyKey: bidKey,
        description: `Bid lock for auction: "${auctionTitle}"`
      }, session);

      // ── STEP 2: ATOMIC AUCTION UPDATE ──────────────────────────────
      // The $lt guard is the core concurrency invariant:
      // - Only a strictly higher bid can update the auction
      // - Equal bids are rejected (first-accepted-wins)
      // - bids[], currentHighestBid, winnerId updated atomically
      const updatedAuction = await Auction.findOneAndUpdate(
        {
          _id: auctionId,
          status: 'ACTIVE',
          currentHighestBid: { $lt: amount }
        },
        {
          $set: {
            currentHighestBid: amount,
            winnerId: userId
          },
          $push: {
            bids: {
              _id: new mongoose.Types.ObjectId(),
              userId,
              amount,
              isBuyNow: false,
              createdAt: new Date()
            }
          }
        },
        { session, returnDocument: 'after' }
      );

      if (!updatedAuction) {
        // The atomic condition failed:
        // (a) A higher or equal bid was already accepted, OR
        // (b) The auction is no longer ACTIVE (finalized concurrently)
        // Transaction aborts → wallet lock is rolled back automatically.
        throw new Error(
          'Bid not accepted — a higher or equal bid was already placed, ' +
          'or the auction is no longer active.'
        );
      }

      // ── STEP 3: Refund the previous highest bidder ─────────────────
      // Deterministic idempotency key (NO Date.now()) → retries are safe
      if (previousWinnerId && previousWinnerId.toString() !== userId.toString()) {
        const refundKey = `outbid-refund-${auctionId}-${previousWinnerId}-${previousAmount}`;
        await WalletService.unlockFunds({
          userId: previousWinnerId,
          amount: previousAmount,
          referenceType: 'REFUND',
          referenceId: currentAuction._id,
          idempotencyKey: refundKey,
          description: `Outbid refund for auction: "${auctionTitle}"`
        }, session);
      }

      // ── STEP 4: Anti-Snipe Extension ───────────────────────────────
      const now = new Date();
      const currentEnd = new Date(updatedAuction.endDate);
      const diffMs = currentEnd - now;
      const TWO_MINUTES_MS = 2 * 60 * 1000;
      const FIVE_MINUTES_MS = 5 * 60 * 1000;
      let antiSnipeExtended = false;

      if (diffMs > 0 && diffMs < TWO_MINUTES_MS) {
        const newEndDate = new Date(currentEnd.getTime() + FIVE_MINUTES_MS);
        await Auction.findOneAndUpdate(
          { _id: auctionId },
          { $set: { endDate: newEndDate } },
          { session }
        );
        updatedAuction.endDate = newEndDate;
        antiSnipeExtended = true;
        console.log(`[Anti-Snipe] Extended auction ${auctionId} by 5 minutes`);
      }

      // ── STEP 5: Commit ─────────────────────────────────────────────
      await session.commitTransaction();

      const bid = updatedAuction.bids[updatedAuction.bids.length - 1];

      // Post-commit: re-schedule auction timer if anti-snipe extended
      if (antiSnipeExtended) {
        const AuctionService = require('./auctionService');
        await AuctionService.scheduleAuctionEnd(updatedAuction);
      }

      return { auction: updatedAuction, bid };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Determine if an error is a transient transaction error that should be retried.
   * WriteConflict (code 112) and TransientTransactionError are retryable.
   * Business logic errors (bid too low, insufficient balance, etc.) are NOT.
   */
  static _isRetryableError(error) {
    // MongoDB driver method
    if (typeof error.hasErrorLabel === 'function' &&
        error.hasErrorLabel('TransientTransactionError')) {
      return true;
    }
    // Mongoose/driver error labels array
    if (error.errorLabels && error.errorLabels.includes('TransientTransactionError')) {
      return true;
    }
    // Direct WriteConflict code
    if (error.code === 112 || error.codeName === 'WriteConflict') {
      return true;
    }
    // Nested WriteConflict in error message (some driver versions)
    if (error.message && error.message.includes('WriteConflict')) {
      return true;
    }
    return false;
  }
}

module.exports = BiddingService;
