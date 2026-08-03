const Bid = require('../models/Bid');
const Auction = require('../models/Auction');
const Participation = require('../models/Participation');
const User = require('../models/User');


// @desc    Place a bid
// @route   POST /api/bid
// @access  Private
const BiddingService = require('../services/biddingService');

const placeBid = async (req, res) => {
  try {
    const { auctionId, amount } = req.body;
    const userId = req.user.id;

    if (!auctionId || !amount) {
      return res.status(400).json({ message: 'Auction ID and amount are required' });
    }

    // Delegate to transactional bidding service
    const { auction: updatedAuction, bid } = await BiddingService.placeBid({
      auctionId,
      userId,
      amount: parseFloat(amount)
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

const getBidHistory = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const bids = await Bid.find({ auctionId })
      .populate('userId', 'name')
      .sort({ amount: -1 }); // Sorted DESC by amount

    res.json(bids);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  placeBid,
  getBidHistory,
};
