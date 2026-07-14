const Participation = require('../models/Participation');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const User = require('../models/User');
const socket = require('../socket');

// @desc    Join an auction
// @route   POST /api/join
// @access  Private
const joinAuction = async (req, res) => {
  try {
    const { auctionId } = req.body;
    const userId = req.user.id;

    if (!auctionId) {
      return res.status(400).json({ message: 'Auction ID is required' });
    }

    // Check if auction exists
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Seller cannot join their own auction
    if (auction.sellerId.toString() === userId) {
      return res.status(403).json({ message: 'You cannot participate in your own auction' });
    }

    if (!auction.isActive) {
      return res.status(400).json({ message: 'Auction is not active' });
    }

    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user || user.walletBalance < auction.startingPrice) {
      return res.status(400).json({ 
        message: `Insufficient wallet balance to join. You need at least ₹${auction.startingPrice} in your wallet.` 
      });
    }

    if (auction.participantsCount >= auction.maxParticipants) {
      return res.status(400).json({ message: `Auction is full (max ${auction.maxParticipants} participants)` });
    }

    // Check if already joined (by email)
    const alreadyJoined = await Participation.findOne({ auctionId, email: user.email });
    if (alreadyJoined) {
      return res.status(200).json({ 
        success: true, 
        joined: true, 
        message: 'Already joined',
        participantsCount: auction.participantsCount 
      });
    }

    // Create participation
    const participation = await Participation.create({
      auctionId,
      userId,
      email: user.email,
    });

    // Update auction participantsCount atomically
    const updatedAuction = await Auction.findOneAndUpdate(
      { 
        _id: auctionId, 
        participantsCount: { $lt: auction.maxParticipants },
        isActive: true 
      },
      { 
        $inc: { participantsCount: 1 } 
      },
      { new: true }
    );

    if (updatedAuction && updatedAuction.participantsCount >= updatedAuction.maxParticipants) {
      if (updatedAuction.autoDelete) {
        // Delete auction and related data
        await Participation.deleteMany({ auctionId: updatedAuction._id });
        await Bid.deleteMany({ auctionId: updatedAuction._id });
        await Auction.findByIdAndDelete(updatedAuction._id);
        
        return res.status(201).json({
          success: true,
          message: 'Joined and auction closed/deleted (reached participant limit)',
          joined: true,
          participantsCount: updatedAuction.participantsCount,
          auction: null // Auction is gone
        });
      } else {
        updatedAuction.isActive = false;
        await updatedAuction.save();
      }
    }

    res.status(201).json({
      success: true,
      message: 'Successfully joined the auction',
      joined: true,
      participantsCount: updatedAuction ? updatedAuction.participantsCount : auction.participantsCount,
      auction: updatedAuction || auction
    });
  } catch (error) {
    console.error('Join Error:', error);
    
    // Handle MongoDB unique constraint error (code 11000 or duplicate key error)
    if (error.code === 11000 || error.message.includes('duplicate')) {
      return res.status(400).json({ 
        message: 'You have already joined this auction',
        joined: true 
      });
    }
    
    // Handle other errors
    if (error.keyPattern && (error.keyPattern.email || error.keyPattern.auctionId)) {
      return res.status(400).json({ 
        message: 'You have already joined this auction',
        joined: true 
      });
    }
    
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const unjoinAuction = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const participation = await Participation.findOne({
      auctionId,
      email: user.email
    });

    if (!participation) {
      return res.status(404).json({
        success: false,
        message: 'Participation not found'
      });
    }

    // User cannot leave after placing a bid
    const hasBid = await Bid.exists({ auctionId, userId });

    if (hasBid) {
      return res.status(400).json({
        success: false,
        message: 'You cannot leave an auction after placing a bid.'
      });
    }

    // Remove participation
    await participation.deleteOne();

    // Decrement participants count atomically
    const auction = await Auction.findOneAndUpdate(
      {
        _id: auctionId,
        participantsCount: { $gt: 0 }
      },
      {
        $inc: { participantsCount: -1 }
      },
      {
        new: true
      }
    );

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // Notify all connected clients
    const io = socket.getIo();
    io.emit('participantsUpdated', {
      auctionId,
      participantsCount: auction.participantsCount
    });

    res.json({
      success: true,
      joined: false,
      message: 'Successfully left the auction.',
      participantsCount: auction.participantsCount
    });

  } catch (error) {
    console.error('Unjoin Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


module.exports = {
  joinAuction,
  unjoinAuction,
};
