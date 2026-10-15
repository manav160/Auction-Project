const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Participation = require('../models/Participation');
const WalletService = require('./walletService');
const Transaction = require('../models/Transaction');

class BiddingService {
  static MAX_RETRIES = 5;

  static async placeBid({
    auctionId,
    userId,
    amount = null,
    increment = null,
    idempotencyKey = null
  }) {
    if (amount == null && increment == null) {
      throw new Error('Bid amount or increment is required');
    }

    const bidAmount = amount != null ? Number(amount) : null;

    const bidKey =
      idempotencyKey ||
      (bidAmount != null
        ? `bid-lock-${auctionId}-${bidAmount}-${userId}`
        : null);

    // Prevent duplicate processing of the same request
    if (bidKey) {
      const existingTransaction = await Transaction.findOne({
        idempotencyKey: bidKey
      });

      if (existingTransaction) {
        const auction = await Auction.findById(auctionId);

        const existingBid = auction.bids.find(
          bid =>
            bid.userId.toString() === userId.toString() &&
            (bidAmount == null || bid.amount === bidAmount)
        );

        return {
          auction,
          bid: existingBid || auction.bids[auction.bids.length - 1]
        };
      }
    }

    // These validations don't need to be repeated on every retry
    const auction = await Auction.findById(auctionId).lean();

    if (!auction) {
      throw new Error('Auction not found');
    }

    if (auction.sellerId.toString() === userId.toString()) {
      throw new Error('You cannot bid on your own auction');
    }

    const participation = await Participation.findOne({
      auctionId: new mongoose.Types.ObjectId(String(auctionId)),
      userId: new mongoose.Types.ObjectId(String(userId))
    });

    if (!participation) {
      throw new Error('You must join the auction before placing a bid');
    }

    // Retry the transaction if MongoDB reports a concurrency conflict
    let lastError;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this._executeBidTransaction({
          auctionId,
          userId,
          amount: bidAmount,
          increment: increment != null ? Number(increment) : null,
          bidKey,
          auctionTitle: auction.title,
          attempt
        });
      } catch (error) {
        lastError = error;

        if (!this._isRetryableError(error) || attempt === this.MAX_RETRIES) {
          throw error;
        }

        const delay =
          Math.min(50 * Math.pow(2, attempt), 500) +
          Math.random() * 50;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  static async _executeBidTransaction({
    auctionId,
    userId,
    amount,
    increment,
    bidKey,
    auctionTitle,
    attempt
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const auction = await Auction.findById(auctionId).session(session);

      if (!auction || auction.status !== 'ACTIVE') {
        throw new Error('Auction is not active');
      }

      if (new Date(auction.endDate) <= new Date()) {
        throw new Error('Auction has already ended');
      }

      if (
        auction.winnerId &&
        auction.winnerId.toString() === userId.toString()
      ) {
        throw new Error(
          'You are already the highest bidder. Wait until someone outbids you.'
        );
      }

      const minimumIncrement = Math.min(
        ...(auction.bidIncrementOptions || [100])
      );

      const bidAmount =
        amount != null
          ? amount
          : auction.currentHighestBid + increment;

      const minimumBid = auction.currentHighestBid + minimumIncrement;

      if (bidAmount < minimumBid) {
        throw new Error(`Bid must be at least ₹${minimumBid}`);
      }

      const previousWinnerId = auction.winnerId;
      const previousAmount = auction.currentHighestBid;

      const effectiveBidKey =
        bidKey ||
        `bid-lock-${auctionId}-${bidAmount}-${userId}-att${attempt}`;

      // Lock bidder's money
      await WalletService.lockFunds(
        {
          userId,
          amount: bidAmount,
          referenceType: 'BID',
          referenceId: auction._id,
          idempotencyKey: effectiveBidKey,
          description: `Bid lock for auction: "${auctionTitle}"`
        },
        session
      );

      // Accept the bid only if it is still higher than the current bid
      const updatedAuction = await Auction.findOneAndUpdate(
        {
          _id: auctionId,
          status: 'ACTIVE',
          currentHighestBid: { $lt: bidAmount }
        },
        {
          $set: {
            currentHighestBid: bidAmount,
            winnerId: userId
          },
          $push: {
            bids: {
              _id: new mongoose.Types.ObjectId(),
              userId,
              amount: bidAmount,
              isBuyNow: false,
              createdAt: new Date()
            }
          }
        },
        {
          session,
          returnDocument: 'after'
        }
      );

      if (!updatedAuction) {
        if (increment != null) {
          throw new Error(
            'BID_INCREMENT_RETRYABLE: Higher bid placed concurrently'
          );
        }

        throw new Error(
          'Bid not accepted — a higher or equal bid was already placed, ' +
          'or the auction is no longer active.'
        );
      }

      // Return money to the previous highest bidder
      if (
        previousWinnerId &&
        previousWinnerId.toString() !== userId.toString()
      ) {
        const refundKey =
          `outbid-refund-${auctionId}-${previousWinnerId}-${previousAmount}`;

        await WalletService.unlockFunds(
          {
            userId: previousWinnerId,
            amount: previousAmount,
            referenceType: 'REFUND',
            referenceId: auction._id,
            idempotencyKey: refundKey,
            description: `Outbid refund for auction: "${auctionTitle}"`
          },
          session
        );
      }

      // Extend auction when a bid arrives in the last 2 minutes
      const now = new Date();
      const remainingTime =
        new Date(updatedAuction.endDate) - now;

      const TWO_MINUTES = 2 * 60 * 1000;
      const FIVE_MINUTES = 5 * 60 * 1000;

      let extended = false;

      if (remainingTime > 0 && remainingTime < TWO_MINUTES) {
        const newEndDate = new Date(
          new Date(updatedAuction.endDate).getTime() + FIVE_MINUTES
        );

        await Auction.findOneAndUpdate(
          { _id: auctionId },
          { $set: { endDate: newEndDate } },
          { session }
        );

        updatedAuction.endDate = newEndDate;
        extended = true;
      }

      await session.commitTransaction();

      const bid =
        updatedAuction.bids[updatedAuction.bids.length - 1];

      if (extended) {
        const AuctionService = require('./auctionService');
        await AuctionService.scheduleAuctionEnd(updatedAuction);
      }

      return {
        auction: updatedAuction,
        bid
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static _isRetryableError(error) {
    if (
      error.message &&
      error.message.includes('BID_INCREMENT_RETRYABLE')
    ) {
      return true;
    }

    if (
      typeof error.hasErrorLabel === 'function' &&
      error.hasErrorLabel('TransientTransactionError')
    ) {
      return true;
    }

    if (
      error.errorLabels &&
      error.errorLabels.includes('TransientTransactionError')
    ) {
      return true;
    }

    if (error.code === 112 || error.codeName === 'WriteConflict') {
      return true;
    }

    return (
      error.message &&
      error.message.includes('WriteConflict')
    );
  }
}

module.exports = BiddingService;