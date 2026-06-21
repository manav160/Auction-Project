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
const increaseBid = async (req, res) => {
  try {
    const { auctionId, increment } = req.body;
    const userId = req.user.id;

    if (!auctionId || !increment) {
      return res.status(400).json({ message: 'Auction ID and increment are required' });
    }

    // Check auction exists
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Check if auction is active
    if (!auction.isActive || new Date() > new Date(auction.endDate)) {
      if (auction.isActive) {
        auction.isActive = false;
        await auction.save();
      }
      return res.status(400).json({ message: 'Auction is closed' });
    }

    // Seller cannot bid on their own auction
    if (auction.sellerId.toString() === userId) {
      return res.status(403).json({ message: 'You cannot bid on your own auction' });
    }

    // Get user to retrieve email
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has joined the auction (by email)
    const hasJoined = await Participation.findOne({ auctionId, email: user.email });
    if (!hasJoined) {
      return res.status(403).json({ message: 'You must join the auction before bidding' });
    }

    // Validate increment is allowed
    if (!auction.bidIncrementOptions.includes(Number(increment))) {
      return res.status(400).json({ 
        message: 'Invalid increment option',
        allowedOptions: auction.bidIncrementOptions 
      });
    }

    const newBidAmount = auction.currentHighestBid + Number(increment);

    // =========================================================================
    // ESCROW / WALLET LOGIC
    // =========================================================================
    
    // 1. Check if the current bidder has enough balance
    const bidder = await User.findById(userId);
    if (!bidder || bidder.walletBalance < newBidAmount) {
      return res.status(400).json({ message: 'Insufficient wallet balance to place this bid' });
    }

    // 2. Refund the previous winner (if any)
    if (auction.winnerId) {
      const prevWinnerId = auction.winnerId;
      const prevBidAmount = auction.currentHighestBid;
      
      // Move locked balance back to wallet balance for the previous winner
      await User.findByIdAndUpdate(prevWinnerId, {
        $inc: { 
          walletBalance: prevBidAmount,
          lockedBalance: -prevBidAmount 
        }
      });
      console.log(`Refunded ₹${prevBidAmount} to user ${prevWinnerId}`);
    }

    // 3. Lock the current bidder's amount
    await User.findByIdAndUpdate(userId, {
      $inc: {
        walletBalance: -newBidAmount,
        lockedBalance: newBidAmount
      }
    });
    console.log(`Locked ₹${newBidAmount} for user ${userId}`);

    // =========================================================================

    // Atomically update the auction
    const updatedAuction = await Auction.findOneAndUpdate(
      {
        _id: auctionId,
        currentHighestBid: auction.currentHighestBid, // ensures no one bid in between
        isActive: true,
      },
      {
        $set: {
          currentHighestBid: newBidAmount,
          winnerId: userId,
        },
      },
      { new: true }
    );


    if (!updatedAuction) {
      return res.status(400).json({
        message: 'Bid failed. Someone might have placed a higher bid or auction closed.',
      });
    }

    const socket = require('../socket');
    const io = socket.getIo();

    // 5. Anti-Snipe Extension Logic
    const now = new Date();
    const currentEnd = new Date(updatedAuction.endDate);
    const diffMs = currentEnd - now;
    const TWO_MINUTES_MS = 2 * 60 * 1000;
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    if (diffMs > 0 && diffMs < TWO_MINUTES_MS) {
      const newEndDate = new Date(currentEnd.getTime() + FIVE_MINUTES_MS);
      updatedAuction.endDate = newEndDate;
      await updatedAuction.save();
      console.log(`Auction ${auctionId} extended by 5 minutes (Anti-Snipe)`);
    }

    // Save the bid record
    const bid = await Bid.create({
      auctionId,
      userId,
      amount: newBidAmount,
    });

    // 6. Emit event to all clients
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
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getJoinedAuctions,
  increaseBid,
};
