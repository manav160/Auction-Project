const BiddingService = require('../services/biddingService');
const { getMyParticipations } = require('./participationController');
const socket = require('../socket');

// @desc    Get auctions the logged-in buyer has joined
// @route   GET /api/buyer/my-auctions
const getJoinedAuctions = getMyParticipations;

// @desc    Increase bid by a specified increment
// @route   POST /api/buyer/increase-bid
const increaseBid = async (req, res) => {
  try {
    const { auctionId, increment } = req.body;
    const userId = req.user.id;

    if (!auctionId || !increment) {
      return res.status(400).json({ message: 'Auction ID and increment are required' });
    }

    const idempotencyKey = req.headers['x-idempotency-key']
      || req.headers['idempotency-key']
      || req.body?.idempotencyKey
      || null;

    const { auction: updatedAuction, bid } = await BiddingService.placeBid({
      auctionId,
      userId,
      increment: Number(increment),
      idempotencyKey
    });

    socket.broadcastBidPlaced({ auctionId, updatedAuction, bid, user: req.user });

    res.status(201).json({
      message: 'Bid increased successfully',
      bid,
      auction: {
        currentHighestBid: updatedAuction.currentHighestBid,
        winnerId: updatedAuction.winnerId,
        endDate: updatedAuction.endDate,
      },
    });

  } catch (error) {
    console.error('Increase Bid Error:', error);
    res.status(400).json({ message: error.message || 'Failed to increase bid' });
  }
};

module.exports = {
  getJoinedAuctions,
  increaseBid,
};

