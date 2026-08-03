const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Participation = require('../models/Participation');
const User = require('../models/User');
const { enrichAuctions } = require('../utils/enricher');


// @desc    Get auctions the logged-in buyer has joined
// @route   GET /api/buyer/my-auctions
// @access  Private (Buyer)
const getJoinedAuctions = async (req, res) => {
  try {
    console.log('GET /api/participations/me | User:', req.user.id);
    
    // Get user to retrieve email
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const participations = await Participation.find({ email: user.email })
      .populate({
        path: 'auctionId',
        populate: { path: 'sellerId', select: 'name email' },
      })
      .sort({ joinedAt: -1 });

    console.log(`Found ${participations.length} participations`);
    const auctions = participations
      .map((p) => p.auctionId)
      .filter(Boolean); // filter out any null refs

    const enrichedAuctions = await enrichAuctions(auctions, req.user.id);
    res.json(enrichedAuctions);
  } catch (error) {
    console.error('Error in getJoinedAuctions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Increase bid by a specified increment
// @route   POST /api/buyer/increase-bid
// @access  Private (Buyer)
const BiddingService = require('../services/biddingService');

const increaseBid = async (req, res) => {
  try {
    const { auctionId, increment } = req.body;
    const userId = req.user.id;

    if (!auctionId || !increment) {
      return res.status(400).json({ message: 'Auction ID and increment are required' });
    }

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const newBidAmount = auction.currentHighestBid + Number(increment);

    // Delegate to transactional bidding service
    const { auction: updatedAuction, bid } = await BiddingService.placeBid({
      auctionId,
      userId,
      amount: newBidAmount
    });

    const socket = require('../socket');
    const io = socket.getIo();
    const biddingUser = await User.findById(userId).select('name email');

    io.emit('bidPlaced', {
      auctionId,
      currentHighestBid: updatedAuction.currentHighestBid,
      winnerId: updatedAuction.winnerId,
      endDate: updatedAuction.endDate,
      bid: {
        ...bid.toObject(),
        userId: {
          _id: userId,
          name: biddingUser?.name || 'Unknown User',
          email: biddingUser?.email || ''
        }
      }
    });

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
