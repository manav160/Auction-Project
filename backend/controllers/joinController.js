const mongoose = require('mongoose');
const Participation = require('../models/Participation');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const WalletService = require('../services/walletService');
const PlatformSettingsService = require('../services/platformSettingsService');
const AuctionService = require('../services/auctionService');
const socket = require('../socket');

// @desc    Join an auction
// @route   POST /api/join
// @access  Private
const joinAuction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { auctionId } = req.body;
    const userId = req.user.id;

    if (!auctionId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Auction ID is required' });
    }

    // Check if auction exists
    const auction = await Auction.findById(auctionId).session(session);
    if (!auction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Anti-Sybil / Self-participation check: Seller cannot join their own auction
    if (auction.sellerId.toString() === userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'You cannot participate in your own auction' });
    }

    if (auction.status !== 'ACTIVE') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Auction is not active' });
    }

    if (auction.participantsCount >= auction.maxParticipants) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Auction is full (max ${auction.maxParticipants} participants)` });
    }

    // Check if already joined by (auctionId, userId)
    const alreadyJoined = await Participation.findOne({ auctionId, userId }).session(session);
    if (alreadyJoined) {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({ 
        success: true, 
        joined: true, 
        message: 'Already joined',
        participantsCount: auction.participantsCount 
      });
    }

    // Verify wallet balance covers startingPrice + entryFee
    const wallet = await WalletService.getWalletByUserId(userId, session);
    const requiredBalance = auction.startingPrice + (auction.entryFee || 0);

    if (!wallet || wallet.availableBalance < requiredBalance) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        message: `Insufficient wallet balance to join. You need at least ₹${requiredBalance} (Starting Price ₹${auction.startingPrice} + Entry Fee ₹${auction.entryFee || 0})` 
      });
    }

    // Process entry fee if present
    const settings = await PlatformSettingsService.getSettings();
    const entryFeePaid = auction.entryFee || 0;

    if (entryFeePaid > 0) {
      await WalletService.payEntryFee({
        buyerId: userId,
        entryFee: entryFeePaid,
        platformSharePct: settings.entryFeeCommissionPct || 20,
        auctionId: auction._id
      }, session);
    }

    // Create normalized participation
    const participation = await Participation.create([{
      auctionId,
      userId,
      entryFeePaid
    }], { session });

    // Atomically increment auction participantsCount & totalEntryFeesCollected
    const updatedAuction = await Auction.findOneAndUpdate(
      { 
        _id: auctionId, 
        participantsCount: { $lt: auction.maxParticipants },
        status: 'ACTIVE' 
      },
      { 
        $inc: { 
          participantsCount: 1,
          totalEntryFeesCollected: entryFeePaid
        } 
      },
      { session, new: true }
    );

    if (!updatedAuction) {
      throw new Error('Auction participant limit was reached concurrently.');
    }

    await session.commitTransaction();
    session.endSession();

    // Check end condition limit
    const hitLimit = updatedAuction.participantsCount >= updatedAuction.maxParticipants;
    if (hitLimit && (updatedAuction.endCondition === 'participants' || updatedAuction.endCondition === 'either')) {
      const resolved = await AuctionService.transitionToPendingResolution(updatedAuction._id);
      if (resolved) {
        await AuctionService.finalizeAuction(updatedAuction._id);
      }
    }

    // Notify clients via socket
    try {
      const io = socket.getIo();
      io.emit('participantsUpdated', {
        auctionId,
        participantsCount: updatedAuction.participantsCount
      });
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: 'Successfully joined the auction',
      joined: true,
      entryFeePaid,
      participantsCount: updatedAuction.participantsCount,
      auction: updatedAuction
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Join Error:', error);

    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'You have already joined this auction',
        joined: true 
      });
    }

    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Unjoin an auction (refunds entry fee if 0 bids placed)
// @route   DELETE /api/auctions/:auctionId/join
// @access  Private
const unjoinAuction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { auctionId } = req.params;
    const userId = req.user.id;

    const participation = await Participation.findOne({ auctionId, userId }).session(session);

    if (!participation) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Participation not found'
      });
    }

    // User cannot leave after placing a bid
    const hasBid = await Bid.exists({ auctionId, userId }).session(session);

    if (hasBid) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'You cannot leave an auction after placing a bid.'
      });
    }

    // Process entry fee refund if user paid entry fee
    const settings = await PlatformSettingsService.getSettings();
    if (participation.entryFeePaid > 0) {
      await WalletService.refundEntryFee({
        buyerId: userId,
        entryFeePaid: participation.entryFeePaid,
        platformSharePct: settings.entryFeeCommissionPct || 20,
        auctionId,
        reason: 'User unjoined auction prior to bidding'
      }, session);
    }

    // Remove participation record
    await Participation.deleteOne({ _id: participation._id }).session(session);

    // Decrement participants count & totalEntryFeesCollected
    const auction = await Auction.findOneAndUpdate(
      {
        _id: auctionId,
        participantsCount: { $gt: 0 }
      },
      {
        $inc: { 
          participantsCount: -1,
          totalEntryFeesCollected: -participation.entryFeePaid
        }
      },
      { session, new: true }
    );

    await session.commitTransaction();
    session.endSession();

    // Notify connected clients
    try {
      const io = socket.getIo();
      io.emit('participantsUpdated', {
        auctionId,
        participantsCount: auction ? auction.participantsCount : 0
      });
    } catch (e) {}

    res.json({
      success: true,
      joined: false,
      message: 'Successfully left the auction.',
      entryFeeRefunded: participation.entryFeePaid,
      participantsCount: auction ? auction.participantsCount : 0
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Unjoin Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

module.exports = {
  joinAuction,
  unjoinAuction,
};
