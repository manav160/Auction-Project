const Auction = require('../models/Auction');
const BiddingService = require('../services/biddingService');
const socket = require('../socket');

// @desc    Place a bid on an auction
// @route   POST /api/bid or POST /api/auctions/:id/bid
const placeBid = async (req, res) => {
  try {
    const auctionId = req.params.id || req.body?.auctionId;
    const { amount, increment } = req.body;
    const userId = req.user.id;

    if (!auctionId || (amount == null && increment == null)) {
      return res.status(400).json({ message: 'Auction ID and bid amount or increment are required' });
    }

    const idempotencyKey = req.headers['x-idempotency-key']
      || req.headers['idempotency-key']
      || req.body?.idempotencyKey
      || null;

    const { auction: updatedAuction, bid } = await BiddingService.placeBid({
      auctionId,
      userId,
      amount: amount != null ? parseFloat(amount) : null,
      increment: increment != null ? Number(increment) : null,
      idempotencyKey
    });

    socket.broadcastBidPlaced({ auctionId, updatedAuction, bid, user: req.user });

    res.status(201).json({
      message: 'Bid placed successfully',
      bid,
      auction: {
        currentHighestBid: updatedAuction.currentHighestBid,
        winnerId: updatedAuction.winnerId,
        endDate: updatedAuction.endDate,
      }
    });
  } catch (error) {
    console.error('Bid Controller Error:', error);
    res.status(400).json({ message: error.message || 'Failed to place bid' });
  }
};

// @desc    Get bid history for an auction
// @route   GET /api/bid/:auctionId or GET /api/auctions/:id/bids
const getBidHistory = async (req, res) => {
  try {
    const auctionId = req.params.auctionId || req.params.id;
    const auction = await Auction.findById(auctionId).populate('bids.userId', 'name email').lean();
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const bids = [...(auction.bids || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(req.baseUrl.includes('/bid') ? bids : { count: bids.length, bids });
  } catch (error) {
    console.error('Get Bid History Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { placeBid, getBidHistory };
