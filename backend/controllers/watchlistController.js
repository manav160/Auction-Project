const Watchlist = require('../models/Watchlist');
const Auction = require('../models/Auction');
const { enrichAuctions } = require('../utils/enricher');

// @desc    Toggle auction in user's watchlist
// @route   POST /api/watchlist/:auctionId/toggle
// @access  Private
const toggleWatchlist = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const userId = req.user.id;

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const existing = await Watchlist.findOne({ userId, auctionId });

    if (existing) {
      await Watchlist.deleteOne({ _id: existing._id });
      return res.json({
        success: true,
        isWatchlisted: false,
        message: 'Removed from watchlist'
      });
    } else {
      await Watchlist.create({ userId, auctionId });
      return res.status(201).json({
        success: true,
        isWatchlisted: true,
        message: 'Added to watchlist'
      });
    }
  } catch (error) {
    console.error('Toggle Watchlist Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's watchlisted auctions
// @route   GET /api/watchlist
// @access  Private
const getWatchlist = async (req, res) => {
  try {
    const userId = req.user.id;

    const watchlistEntries = await Watchlist.find({ userId }).sort({ createdAt: -1 });
    const auctionIds = watchlistEntries.map(e => e.auctionId);

    const auctions = await Auction.find({ _id: { $in: auctionIds } })
      .populate('sellerId', 'name email');

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

module.exports = {
  toggleWatchlist,
  getWatchlist
};
