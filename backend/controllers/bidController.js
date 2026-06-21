const Bid = require('../models/Bid');
const Auction = require('../models/Auction');
const Participation = require('../models/Participation');
const User = require('../models/User');


// @desc    Place a bid
// @route   POST /api/bid
// @access  Private
const placeBid = async (req, res) => {
  try {
    const { auctionId, amount } = req.body;
    const userId = req.user.id;

    if (!auctionId || !amount) {
      return res.status(400).json({ message: 'Auction ID and amount are required' });
    }

    // Check auction exists first
    const auctionCheck = await Auction.findById(auctionId);
    if (!auctionCheck) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Get user to retrieve email
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 1. Check if user has joined the auction (by email)
    const hasJoined = await Participation.findOne({ auctionId, email: user.email });
    if (!hasJoined) {
      return res.status(403).json({ message: 'You must join the auction before bidding' });
    }

    // 2. Seller cannot bid on their own auction
    if (auctionCheck.sellerId.toString() === userId) {
      return res.status(403).json({ message: 'You cannot bid on your own auction' });
    }

    // 2. Check auction is active and time valid
    
    if (!auctionCheck.isActive || new Date() > new Date(auctionCheck.endDate)) {
      // If time passed but isActive is still true, close it
      if (auctionCheck.isActive) {
        auctionCheck.isActive = false;
        await auctionCheck.save();
      }
      return res.status(400).json({ message: 'Auction is closed' });
    }

    const minAllowedBid = auctionCheck.currentHighestBid + 100;
    if (amount < minAllowedBid) {
      return res.status(400).json({ 
        message: `Bid must be at least ₹${minAllowedBid}` 
      });
    }

    // =========================================================================
    // ESCROW / WALLET LOGIC
    // =========================================================================
    
    // 1. Check if the current bidder has enough balance
    const bidder = await User.findById(userId);
    if (!bidder || bidder.walletBalance < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance to place this bid' });
    }

    // 2. Refund the previous winner (if any)
    if (auctionCheck.winnerId) {
      const prevWinnerId = auctionCheck.winnerId;
      const prevBidAmount = auctionCheck.currentHighestBid;
      
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
        walletBalance: -amount,
        lockedBalance: amount
      }
    });
    console.log(`Locked ₹${amount} for user ${userId}`);

    // =========================================================================

    // 3. Atomically update the auction if the bid is higher
    // This prevents concurrency issues (e.g. 2 users reading the same highest bid and updating at same time)
    const updatedAuction = await Auction.findOneAndUpdate(
      { 
        _id: auctionId, 
        currentHighestBid: { $lt: amount },
        isActive: true,
      },
      { 
        $set: { 
          currentHighestBid: amount,
          winnerId: userId 
        } 
      },
      { new: true }
    );


    if (!updatedAuction) {
      // If no document was returned, it means either:
      // 1. The auction was closed in the meantime
      // 2. Someone else placed a higher or equal bid in the meantime
      return res.status(400).json({ message: 'Bid failed. Someone might have placed a higher bid or auction closed.' });
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

    // 4. Save the bid record
    const bid = await Bid.create({
      auctionId,
      userId,
      amount,
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
      message: 'Bid placed successfully',
      bid,
      auction: {
        currentHighestBid: updatedAuction.currentHighestBid,
        winnerId: updatedAuction.winnerId,
        endDate: updatedAuction.endDate,
      }
    });


  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getBidHistory = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const bids = await Bid.find({ auctionId })
      .populate('userId', 'name email')
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
