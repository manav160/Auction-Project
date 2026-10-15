const Auction = require('../models/Auction');
const WalletService = require('../services/walletService');
const AuctionService = require('../services/auctionService');
const PlatformSettingsService = require('../services/platformSettingsService');
const { withTransaction } = require('../utils/transaction');

// @desc    Extend an auction by N days (default 1)
// @route   POST /api/extend or POST /api/extend/:id or POST /api/auctions/:id/extend
const extendAuction = async (req, res) => {
  try {
    const targetId = req.params.id || req.body?.auctionId;
    const days = Math.max(1, Math.min(7, parseInt(req.body?.days ?? 1, 10) || 1));
    const userId = req.user.id;

    const settings = await PlatformSettingsService.getSettings();
    const feePerDay = settings.extensionFee || 100;
    const totalFee = days * feePerDay;

    const updatedAuction = await withTransaction(async (session) => {
      const auction = await Auction.findById(targetId).session(session);
      if (!auction) {
        const err = new Error('Auction not found');
        err.statusCode = 404;
        throw err;
      }
      if (auction.sellerId.toString() !== userId) {
        const err = new Error('Only the seller can extend the auction');
        err.statusCode = 403;
        throw err;
      }
      if (auction.status !== 'ACTIVE') {
        throw new Error('Cannot extend an inactive auction');
      }

      const currentExtended = auction.extendedDays || 0;
      if (currentExtended + days > 7) {
        throw new Error(`Total extension limit exceeded. Maximum ${7 - currentExtended} more days available.`);
      }

      if (totalFee > 0) {
        const reqIdempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey;
        await WalletService.payFee({
          userId,
          amount: totalFee,
          referenceType: 'EXTENSION_FEE',
          referenceId: auction._id,
          idempotencyKey: reqIdempotencyKey || `extend-${auction._id}-${currentExtended}-${days}`,
          description: `Extension fee of ₹${totalFee} paid for auction: "${auction.title}"`
        }, session);
      }

      const newEndDate = new Date(auction.endDate);
      newEndDate.setDate(newEndDate.getDate() + days);

      const updated = await Auction.findOneAndUpdate(
        { _id: auction._id, status: 'ACTIVE', extendedDays: { $lte: 7 - days } },
        {
          $inc: { extendedDays: days, totalExtensionFeePaid: totalFee },
          $set: { endDate: newEndDate, lastExtensionDate: new Date() },
          $push: { extensionHistory: { days, fee: totalFee, extendedAt: new Date() } }
        },
        { session, returnDocument: 'after' }
      );

      if (!updated) throw new Error('Extension limit exceeded (7 days maximum) or auction is no longer active.');
      return updated;
    });

    await AuctionService.scheduleAuctionEnd(updatedAuction);

    res.json({
      message: `Auction extended successfully by ${days} day(s)`,
      fee: totalFee,
      extendedDays: updatedAuction.extendedDays,
      newEndDate: updatedAuction.endDate,
      auction: {
        id: updatedAuction._id,
        newEndDate: updatedAuction.endDate,
        feePaid: totalFee
      }
    });
  } catch (error) {
    console.error('Extend Auction Error:', error);
    res.status(error.statusCode || 400).json({ message: error.message || 'Failed to extend auction' });
  }
};

module.exports = { extendAuction };
