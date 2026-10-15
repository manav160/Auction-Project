const Watchlist = require('../models/Watchlist');
const Auction = require('../models/Auction');
const { enrichAuctions } = require('../utils/enricher');
const { withTransaction } = require('../utils/transaction');

// @desc    Toggle auction in user's watchlist
// @route   POST /api/watchlist/:auctionId/toggle
const toggleWatchlist = async (req, res) => {
  const { auctionId } = req.params;
  const userId = req.user.id;

  try {
    const auctionExists = await Auction.exists({ _id: auctionId });
    if (!auctionExists) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const result = await withTransaction(async (session) => {
      const existing = await Watchlist.findOne({ userId, auctionId }).session(session);

      if (existing) {
        await Watchlist.deleteOne({ _id: existing._id }).session(session);
        return { isWatchlisted: false, message: 'Removed from watchlist', statusCode: 200 };
      }

      await Watchlist.create([{ userId, auctionId }], { session });
      return { isWatchlisted: true, message: 'Added to watchlist', statusCode: 201 };
    });

    return res.status(result.statusCode).json({
      success: true,
      isWatchlisted: result.isWatchlisted,
      message: result.message
    });
  } catch (error) {
    if (error.code === 11000 || error.name === 'WriteConflict') {
      const current = await Watchlist.exists({ userId, auctionId });
      return res.json({
        success: true,
        isWatchlisted: !!current,
        message: current ? 'Added to watchlist' : 'Removed from watchlist'
      });
    }
    console.error('Toggle Watchlist Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's watchlisted auctions
// @route   GET /api/watchlist
const getWatchlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const watchlistEntries = await Watchlist.find({ userId }).sort({ createdAt: -1 });
    const auctionIds = watchlistEntries.map((e) => e.auctionId);

    const auctions = await Auction.find({ _id: { $in: auctionIds } }).populate('sellerId', 'name email');
    const enrichedAuctions = await enrichAuctions(auctions, userId);

    res.json({
      count: enrichedAuctions.length,
      auctions: enrichedAuctions
    });
  } catch (error) {
    console.error('Get Watchlist Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { toggleWatchlist, getWatchlist };
