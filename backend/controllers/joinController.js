const Participation = require('../models/Participation');
const Auction = require('../models/Auction');
const WalletService = require('../services/walletService');
const PlatformSettingsService = require('../services/platformSettingsService');
const AuctionService = require('../services/auctionService');
const { withTransaction } = require('../utils/transaction');
const socket = require('../socket');

// @desc    Join an auction
// @route   POST /api/join or POST /api/auctions/:id/join
const joinAuction = async (req, res) => {
  try {
    const auctionId = req.params.id || req.body?.auctionId;
    const userId = req.user.id;

    if (!auctionId) {
      return res.status(400).json({ message: 'Auction ID is required' });
    }

    const settings = await PlatformSettingsService.getSettings();

    const result = await withTransaction(async (session) => {
      const auction = await Auction.findById(auctionId).session(session);
      if (!auction) {
        const err = new Error('Auction not found');
        err.statusCode = 404;
        throw err;
      }
      if (auction.sellerId.toString() === userId) {
        const err = new Error('You cannot participate in your own auction');
        err.statusCode = 403;
        throw err;
      }
      if (auction.status !== 'ACTIVE') {
        throw new Error('Auction is not active');
      }
      if (auction.participantsCount >= auction.maxParticipants) {
        throw new Error(`Auction is full (max ${auction.maxParticipants} participants)`);
      }

      const alreadyJoined = await Participation.findOne({ auctionId, userId }).session(session);
      if (alreadyJoined) {
        return { alreadyJoined: true, participantsCount: auction.participantsCount };
      }

      const wallet = await WalletService.getWalletByUserId(userId, session);
      const requiredBalance = auction.startingPrice + (auction.entryFee || 0);
      if (!wallet || wallet.availableBalance < requiredBalance) {
        throw new Error(
          `Insufficient wallet balance to join. You need at least ₹${requiredBalance} (Starting Price ₹${auction.startingPrice} + Entry Fee ₹${auction.entryFee || 0})`
        );
      }

      const entryFeePaid = auction.entryFee || 0;
      if (entryFeePaid > 0) {
        await WalletService.payEntryFee({
          buyerId: userId,
          entryFee: entryFeePaid,
          platformSharePct: settings.entryFeeCommissionPct || 20,
          auctionId: auction._id
        }, session);
      }

      await Participation.create([{ auctionId, userId, entryFeePaid }], { session, ordered: true });

      const updatedAuction = await Auction.findOneAndUpdate(
        { _id: auctionId, participantsCount: { $lt: auction.maxParticipants }, status: 'ACTIVE' },
        { $inc: { participantsCount: 1, totalEntryFeesCollected: entryFeePaid } },
        { session, returnDocument: 'after' }
      );

      if (!updatedAuction) throw new Error('Auction participant limit was reached concurrently.');

      return { updatedAuction, entryFeePaid };
    });

    if (result.alreadyJoined) {
      return res.status(200).json({
        success: true,
        joined: true,
        message: 'Already joined',
        participantsCount: result.participantsCount
      });
    }

    const { updatedAuction, entryFeePaid } = result;

    const hitLimit = updatedAuction.participantsCount >= updatedAuction.maxParticipants;
    if (hitLimit && (updatedAuction.endCondition === 'participants' || updatedAuction.endCondition === 'either')) {
      const resolved = await AuctionService.transitionToPendingResolution(updatedAuction._id, { force: true });
      if (resolved) await AuctionService.finalizeAuction(updatedAuction._id);
    }

    try {
      socket.getIo().emit('participantsUpdated', { auctionId, participantsCount: updatedAuction.participantsCount });
    } catch (e) {
      // Ignore socket error
    }

    res.status(201).json({
      success: true,
      message: 'Successfully joined the auction',
      joined: true,
      entryFeePaid,
      participantsCount: updatedAuction.participantsCount,
      auction: updatedAuction
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(200).json({ success: true, message: 'Already joined', joined: true });
    }
    console.error('Join Error:', error);
    res.status(error.statusCode || 400).json({ message: error.message || 'Server error' });
  }
};

// @desc    Unjoin an auction (refunds entry fee if 0 bids placed)
// @route   DELETE /api/auctions/:id/join or DELETE /api/join/:id
const unjoinAuction = async (req, res) => {
  try {
    const auctionId = req.params.auctionId || req.params.id || req.body?.auctionId;
    const userId = req.user.id;
    const settings = await PlatformSettingsService.getSettings();

    const { participation, auction } = await withTransaction(async (session) => {
      const p = await Participation.findOne({ auctionId, userId }).session(session);
      if (!p) {
        const err = new Error('Participation not found');
        err.statusCode = 404;
        throw err;
      }

      const hasBid = await Auction.exists({ _id: auctionId, 'bids.userId': userId }).session(session);
      if (hasBid) {
        const err = new Error('You cannot leave an auction after placing a bid.');
        err.statusCode = 400;
        throw err;
      }

      if (p.entryFeePaid > 0) {
        await WalletService.refundEntryFee({
          buyerId: userId,
          entryFeePaid: p.entryFeePaid,
          platformSharePct: settings.entryFeeCommissionPct || 20,
          auctionId,
          reason: 'User unjoined auction prior to bidding'
        }, session);
      }

      await Participation.deleteOne({ _id: p._id }).session(session);

      const updated = await Auction.findOneAndUpdate(
        { _id: auctionId, participantsCount: { $gt: 0 }, 'bids.userId': { $ne: userId } },
        { $inc: { participantsCount: -1, totalEntryFeesCollected: -p.entryFeePaid } },
        { session, returnDocument: 'after' }
      );

      if (!updated) {
        throw new Error('Cannot leave auction because a bid was placed concurrently or auction is no longer active.');
      }

      return { participation: p, auction: updated };
    });

    try {
      socket.getIo().emit('participantsUpdated', { auctionId, participantsCount: auction.participantsCount });
    } catch (e) {
      // Ignore socket error
    }

    res.json({
      success: true,
      joined: false,
      message: 'Successfully left the auction.',
      entryFeeRefunded: participation.entryFeePaid,
      participantsCount: auction.participantsCount
    });
  } catch (error) {
    console.error('Unjoin Error:', error);
    res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = { joinAuction, unjoinAuction };
