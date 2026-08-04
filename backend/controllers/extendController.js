const Auction = require('../models/Auction');
const MockPayment = require('../models/MockPayment');
const mongoose = require('mongoose');
const WalletService = require('../services/walletService');
const AuctionService = require('../services/auctionService');

// @desc    Extend an auction
// @route   POST /api/extend
// @access  Private (Seller owner only)
const extendAuction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { auctionId, days } = req.body;
    const userId = req.user.id;
    const parsedDays = parseInt(days, 10);

    if (!parsedDays || parsedDays < 1 || parsedDays > 7) {
      return res.status(400).json({ message: 'Extension days must be between 1 and 7' });
    }

    const auction = await Auction.findById(auctionId || req.params.id).session(session);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Only the seller can extend their own auction
    if (auction.sellerId.toString() !== userId) {
      return res.status(403).json({ message: 'Only the seller can extend the auction' });
    }

    // Check if auction is active before extending
    if (auction.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Cannot extend an inactive auction' });
    }

    if (auction.extendedDays + parsedDays > 7) {
      return res.status(400).json({ 
        message: `Total extension limit exceeded. You can only extend for a maximum of ${7 - auction.extendedDays} more days.` 
      });
    }

    // Calculate fee
    const fee = parsedDays * Math.max(10, 0.01 * auction.currentHighestBid);

    // Deduct the fee from the seller's available balance in the wallet
    const idempotencyKey = `extension-fee-${auction._id}-${auction.extendedDays}-${parsedDays}-${Date.now()}`;
    await WalletService.payFee({
      userId,
      amount: fee,
      referenceType: 'EXTENSION_FEE',
      referenceId: auction._id,
      idempotencyKey,
      description: `Extension fee of ₹${fee} paid for auction: "${auction.title}"`
    }, session);

    // Mock payment record for logging
    await MockPayment.create([{
      auctionId: auction._id,
      sellerId: userId,
      amount: fee,
      status: 'Success'
    }], { session, ordered: true });

    // Update auction dates and extension parameters
    const currentEndDate = new Date(auction.endDate);
    currentEndDate.setDate(currentEndDate.getDate() + parsedDays);

    auction.endDate = currentEndDate;
    auction.extendedDays += parsedDays;
    auction.totalExtensionFeePaid += fee;
    auction.lastExtensionDate = new Date();
    auction.extensionHistory.push({
      days: parsedDays,
      fee,
      extendedAt: new Date()
    });

    await auction.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Reschedule in-memory timer with the new date outside the database transaction
    await AuctionService.scheduleAuctionEnd(auction);

    res.json({
      message: `Auction extended successfully by ${parsedDays} day(s)`,
      fee,
      extendedDays: auction.extendedDays,
      newEndDate: auction.endDate
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Extend Auction Error:', error);
    res.status(400).json({ message: error.message || 'Failed to extend auction' });
  }
};

module.exports = {
  extendAuction,
};
