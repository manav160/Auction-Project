const Auction = require('../models/Auction');
const Participation = require('../models/Participation');
const Transaction = require('../models/Transaction');
const { scheduleAuction, cancelAuction } = require('../utils/queue');
const { withTransaction } = require('../utils/transaction');
const WalletService = require('./walletService');
const PlatformSettingsService = require('./platformSettingsService');
const socket = require('../socket');

class AuctionService {
  static async scheduleAuctionEnd(auction) {
    scheduleAuction(auction._id.toString(), auction.endDate, async (auctionId) => {
      const resolvedAuction = await this.transitionToPendingResolution(auctionId);
      if (resolvedAuction) await this.finalizeAuction(auctionId);
    });
  }

  static async transitionToPendingResolution(auctionId, options = {}) {
    try {
      const updatedAuction = await withTransaction(async (session) => {
        const auction = await Auction.findById(auctionId).session(session);
        if (!auction || auction.status !== 'ACTIVE') return null;

        if (!options?.force && new Date(auction.endDate) > new Date()) {
          await this.scheduleAuctionEnd(auction);
          return null;
        }

        const query = { _id: auctionId, status: 'ACTIVE' };
        if (!options?.force) query.endDate = { $lte: new Date() };

        return await Auction.findOneAndUpdate(
          query,
          { status: 'PENDING_RESOLUTION' },
          { session, returnDocument: 'after' }
        );
      });

      if (updatedAuction) {

        try {
          socket.getIo().emit('auctionClosed', { auctionId });
        } catch (err) {
          // Socket may be offline during background tasks
        }
      }

      return updatedAuction;
    } catch (error) {
      console.error(`Error transitioning auction ${auctionId}:`, error);
      throw error;
    }
  }

  static async finalizeAuction(auctionId) {
    const settings = await PlatformSettingsService.getSettings();

    return await withTransaction(async (session) => {
      const auction = await Auction.findById(auctionId).session(session);
      if (!auction || auction.status !== 'PENDING_RESOLUTION') {
        throw new Error('Auction is not ready for finalization');
      }

      const status = auction.winnerId ? 'COMPLETED' : 'UNSOLD';
      const commission = auction.finalValueCommissionPct || (
        auction.listingType === 'PREMIUM'
          ? settings.premiumCommissionPct
          : settings.standardCommissionPct
      );

      const platformShare = settings.entryFeeCommissionPct || 20;
      const entryFeeEscrow = Math.round(
        (auction.totalEntryFeesCollected || 0) * (100 - platformShare) / 100
      );

      await WalletService.payoutSellerOnFinalization(
        {
          winnerId: auction.winnerId,
          sellerId: auction.sellerId,
          winningBid: auction.currentHighestBid,
          finalValueCommissionPct: commission,
          totalEntryFeeEscrow: entryFeeEscrow,
          auctionId: auction._id
        },
        session
      );

      const finalizedAuction = await Auction.findOneAndUpdate(
        { _id: auctionId, status: 'PENDING_RESOLUTION' },
        { status },
        { session, returnDocument: 'after' }
      );


      return finalizedAuction;
    });
  }

  static async executeBuyNow({ auctionId, buyerId, idempotencyKey }) {
    const settings = await PlatformSettingsService.getSettings();
    const key = idempotencyKey || `buynow-${auctionId}-${buyerId}`;

    if (idempotencyKey) {
      const existingTransaction = await Transaction.findOne({ idempotencyKey });
      if (existingTransaction) return Auction.findById(auctionId);
    }

    const completedAuction = await withTransaction(async (session) => {
      const auction = await Auction.findById(auctionId).session(session);
      if (!auction || auction.status !== 'ACTIVE') throw new Error('Auction is no longer available');
      if (!auction.buyNowPrice) throw new Error('Buy Now is not available');
      if (auction.sellerId.toString() === buyerId.toString()) throw new Error('You cannot buy your own auction');
      if (auction.currentHighestBid >= auction.buyNowPrice * 0.8) {
        throw new Error('Buy Now is disabled because the current bid is too high');
      }

      const existingTransaction = await Transaction.findOne({ idempotencyKey: key }).session(session);
      if (existingTransaction) return auction;

      // Atomically complete the auction and retrieve the document BEFORE update
      const previousAuction = await Auction.findOneAndUpdate(
        {
          _id: auctionId,
          status: 'ACTIVE',
          buyNowPurchased: false,
          buyNowPrice: { $gt: 0 },
          sellerId: { $ne: buyerId },
          currentHighestBid: { $lt: auction.buyNowPrice * 0.8 }
        },
        {
          status: 'COMPLETED',
          winnerId: buyerId,
          currentHighestBid: auction.buyNowPrice,
          buyNowPurchased: true,
          $push: {
            bids: {
              userId: buyerId,
              amount: auction.buyNowPrice,
              isBuyNow: true
            }
          }
        },
        { session, returnDocument: 'before' }
      );

      if (!previousAuction) {
        throw new Error('Auction was already purchased or bid threshold exceeded');
      }

      // Refund the previous highest bidder
      if (previousAuction.winnerId) {
        await WalletService.unlockFunds(
          {
            userId: previousAuction.winnerId,
            amount: previousAuction.currentHighestBid,
            referenceType: 'REFUND',
            referenceId: previousAuction._id,
            idempotencyKey: `buynow-refund-${previousAuction._id}-${previousAuction.winnerId}-${previousAuction.currentHighestBid}`,
            description: 'Bid refunded after Buy Now'
          },
          session
        );
      }

      const commission = previousAuction.finalValueCommissionPct || (
        previousAuction.listingType === 'PREMIUM'
          ? settings.premiumCommissionPct
          : settings.standardCommissionPct
      );

      const platformShare = settings.entryFeeCommissionPct || 20;
      const entryFeeEscrow = Math.round(
        (previousAuction.totalEntryFeesCollected || 0) * (100 - platformShare) / 100
      );

      await WalletService.processBuyNowPayment(
        {
          buyerId,
          sellerId: previousAuction.sellerId,
          buyNowPrice: previousAuction.buyNowPrice,
          finalValueCommissionPct: commission,
          totalEntryFeeEscrow: entryFeeEscrow,
          auctionId: previousAuction._id,
          idempotencyKey: key
        },
        session
      );

      return await Auction.findById(auctionId).session(session);
    });

    this.cancelScheduledEnd(auctionId);

    try {
      socket.getIo().emit('auctionClosed', {
        auctionId,
        winnerId: buyerId,
        winningBid: completedAuction.buyNowPrice,
        buyNowPurchased: true
      });
    } catch (e) {
      // Ignore socket error
    }

    return completedAuction;
  }

  static async cancelAuctionWithRefunds(auctionId, cancelledByUserId) {
    const settings = await PlatformSettingsService.getSettings();

    const updatedAuction = await withTransaction(async (session) => {
      const auction = await Auction.findOneAndUpdate(
        { _id: auctionId, status: { $nin: ['COMPLETED', 'CANCELED', 'UNSOLD'] } },
        { status: 'CANCELED' },
        { session, returnDocument: 'before' }
      );

      if (!auction) throw new Error('Auction not found or already closed');

      if (auction.winnerId) {
        await WalletService.unlockFunds(
          {
            userId: auction.winnerId,
            amount: auction.currentHighestBid,
            referenceType: 'REFUND',
            referenceId: auctionId,
            idempotencyKey: `cancel-refund-${auction._id}-${auction.winnerId}-${auction.currentHighestBid}`,
            description: 'Bid refunded because auction was canceled'
          },
          session
        );
      }

      const participations = await Participation.find({ auctionId }).session(session);
      for (const participation of participations) {
        if (participation.entryFeePaid > 0) {
          await WalletService.refundEntryFee(
            {
              buyerId: participation.userId,
              entryFeePaid: participation.entryFeePaid,
              platformSharePct: settings.entryFeeCommissionPct || 20,
              auctionId,
              reason: 'Auction canceled'
            },
            session
          );
        }
      }

      return await Auction.findById(auctionId).session(session);
    });

    this.cancelScheduledEnd(auctionId);
    return updatedAuction;
  }

  static async startAuction(auctionId) {
    const auction = await Auction.findOneAndUpdate(
      { _id: auctionId, status: { $in: ['DRAFT', 'SCHEDULED'] } },
      { status: 'ACTIVE' },
      { returnDocument: 'after' }
    );

    if (!auction) return null;
    await this.scheduleAuctionEnd(auction);
    return auction;
  }

  static cancelScheduledEnd(auctionId) {
    cancelAuction(auctionId.toString());
  }

  static async recoverActiveAuctions() {
    const auctions = await Auction.find({ status: 'ACTIVE' });
    for (const auction of auctions) {
      await this.scheduleAuctionEnd(auction);
    }
    console.log(`Recovered ${auctions.length} active auction(s)`);
  }
}

module.exports = AuctionService;