const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Participation = require('../models/Participation');
const { enrichAuction, enrichAuctions } = require('../utils/enricher');
const { isValidObjectId } = require('mongoose');



// =============================================================================
// AUCTION CRUD
// =============================================================================

// @desc    Get all auctions (with optional filters)
// @route   GET /api/auctions
// @access  Public
const getAuctions = async (req, res) => {
  try {
    const { status, search, sort } = req.query;

    // Build filter
    const filter = {};// Default: no filter
    if (status === 'active') {
      filter.isActive = true;
      filter.endDate = { $gt: new Date() };
    } 
    else if (status === 'closed') {
      filter.$or = [
        { isActive: false },
        { endDate: { $lte: new Date() } },
      ];
    }
    
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    // Build sort
    let sortOption = { createdAt: -1 }; // default: newest first
    if (sort === 'ending-soon') {
      sortOption = { endDate: 1 };
    } else if (sort === 'highest-bid') {
      sortOption = { currentHighestBid: -1 };
    } else if (sort === 'most-participants') {
      sortOption = { participantsCount: -1 };
    }

    const auctions = await Auction.find(filter)
      .populate('sellerId', 'name email')
      .sort(sortOption);

    const enrichedAuctions = await enrichAuctions(auctions, req.user?.id);
    res.json(enrichedAuctions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single auction by ID (with participation & bid info for logged-in user)
// @route   GET /api/auctions/:id
// @access  Public (enhanced if authenticated)
const getAuctionById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid auction ID' });
    }

    const auction = await Auction.findById(req.params.id)
      .populate('sellerId', 'name email')
      .populate('winnerId', 'name email');

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Auto-close expired auctions
    if (auction.isActive && new Date() > new Date(auction.endDate)) {
      if (auction.autoDelete) {
        await Participation.deleteMany({ auctionId: auction._id });
        await Bid.deleteMany({ auctionId: auction._id });
        await Auction.findByIdAndDelete(auction._id);
        return res.status(404).json({ message: 'Auction expired and was auto-deleted' });
      } else {
        auction.isActive = false;
        await auction.save();
      }
    }

    const enrichedAuction = await enrichAuction(auction, req.user?.id);
    res.json(enrichedAuction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create an auction
// @route   POST /api/auctions
// @access  Private (Seller only)
const createAuction = async (req, res) => {
  try {
    const { title, description, startingPrice, endDate, bidIncrementOptions, maxParticipants, endCondition, autoDelete } = req.body;

    if (!title || !description || startingPrice == null || !endDate) {
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    // Validate endDate is in the future
    if (new Date(endDate) <= new Date()) {
      return res.status(400).json({ message: 'End date must be in the future' });
    }

    // Validate startingPrice is positive
    if (startingPrice <= 0) {
      return res.status(400).json({ message: 'Starting price must be greater than 0' });
    }

    const auction = await Auction.create({
      title,
      description,
      startingPrice,
      endDate,
      sellerId: req.user.id,
      bidIncrementOptions: bidIncrementOptions ?? [100, 500, 1000],
      maxParticipants: maxParticipants ?? 15,
      endCondition: endCondition ?? 'either',
      autoDelete: autoDelete ?? false,
    });

    res.status(201).json(auction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update an auction (only before any bids are placed)
// @route   PUT /api/auctions/:id
// @access  Private (Seller owner only)
const updateAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Only the seller who created it can update
    if (auction.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this auction' });
    }

    // Cannot update if bids have been placed
    const bidCount = await Bid.countDocuments({ auctionId: auction._id });
    if (bidCount > 0) {
      return res.status(400).json({ message: 'Cannot update auction after bids have been placed' });
    }

    const { title, description, startingPrice, endDate, bidIncrementOptions } = req.body;

    if (title) auction.title = title;
    if (description) auction.description = description;
    if (startingPrice) {
      if (startingPrice <= 0) {
        return res.status(400).json({ message: 'Starting price must be greater than 0' });
      }
      auction.startingPrice = startingPrice;
      auction.currentHighestBid = startingPrice;
    }
    if (endDate) {
      if (new Date(endDate) <= new Date()) {
        return res.status(400).json({ message: 'End date must be in the future' });
      }
      auction.endDate = endDate;
    }
    if (bidIncrementOptions) {
      if (!Array.isArray(bidIncrementOptions)) {
        return res.status(400).json({ message: 'bidIncrementOptions must be an array' });
      }
      auction.bidIncrementOptions = bidIncrementOptions;
    }
    if (req.body.maxParticipants) auction.maxParticipants = req.body.maxParticipants;
    if (typeof req.body.autoDelete !== 'undefined') auction.autoDelete = req.body.autoDelete;

    await auction.save();
    res.json(auction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete an auction (only before any bids are placed)
// @route   DELETE /api/auctions/:id
// @access  Private (Seller owner only)
const deleteAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Only the seller who created it can delete
    if (auction.sellerId.toString() !== req.user.id) {// see in up we created auction object which is mongodb object and we are comparing it with string so we need to convert it to string
      return res.status(403).json({ message: 'Not authorized to delete this auction' });
    }

    // Cannot delete if bids have been placed
    const bidCount = await Bid.countDocuments({ auctionId: auction._id });
    if (bidCount > 0) {
      return res.status(400).json({ message: 'Cannot delete auction after bids have been placed' });
    }

    // Clean up related participations
    await Participation.deleteMany({ auctionId: auction._id });
    await Auction.deleteOne({ _id: req.params.id });

    res.json({ message: 'Auction deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =============================================================================
// SELLER ROUTES
// =============================================================================

// @desc    Get logged-in seller's auctions
// @route   GET /api/auctions/seller
// @access  Private (Seller only)
const getSellerAuctions = async (req, res) => {
  try {
    console.log('GET /api/auctions/seller | User:', req.user.id);
    const auctions = await Auction.find({ sellerId: req.user.id })
      .sort({ createdAt: -1 });
    console.log(`Found ${auctions.length} auctions for seller`);
    const enrichedAuctions = await enrichAuctions(auctions, req.user.id);
    res.json(enrichedAuctions);
  } catch (error) {
    console.error('Error in getSellerAuctions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// =============================================================================
// JOIN / PARTICIPATE
// =============================================================================

// @desc    Join an auction
// @route   POST /api/auctions/:id/join
// @access  Private (Buyer only)
const joinAuction = async (req, res) => {
  try {
    const auctionId = req.params.id;
    const userId = req.user.id;

    // Check if auction exists
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Seller cannot join their own auction
    if (auction.sellerId.toString() === userId) {
      return res.status(403).json({ message: 'You cannot participate in your own auction' });
    }

    // Check if auction is active and not expired
    if (!auction.isActive || new Date() > new Date(auction.endDate)) {
      if (auction.isActive) {
        auction.isActive = false;
        await auction.save();
      }
      return res.status(400).json({ message: 'Auction is not active' });
    }

    if (auction.participantsCount >= 15) {
      return res.status(400).json({ message: 'Auction is full (max 15 participants)' });
    }

    // Get user to retrieve email
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already joined (by email)
    const alreadyJoined = await Participation.findOne({ auctionId, email: user.email });
    if (alreadyJoined) {
      return res.status(400).json({ message: 'You have already joined this auction' });
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

    if (updatedAuction) {
      // If end condition involves participants and we hit the limit, close it
      const hitLimit = updatedAuction.participantsCount >= updatedAuction.maxParticipants;
      if (hitLimit && (updatedAuction.endCondition === 'participants' || updatedAuction.endCondition === 'either')) {
        updatedAuction.isActive = false;
        await updatedAuction.save();
      }
    }

    res.status(201).json({
      message: 'Successfully joined the auction',
      participation,
      auction: updatedAuction ? {
        id: updatedAuction._id,
        participantsCount: updatedAuction.participantsCount,
        isActive: updatedAuction.isActive,
      } : auction,
    });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already joined this auction' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get participants of an auction
// @route   GET /api/auctions/:id/participants
// @access  Private
const getParticipants = async (req, res) => {
  try {
    const auctionId = req.params.id;

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const participants = await Participation.find({ auctionId })
      .populate('userId', 'name email')
      .sort({ joinedAt: -1 });

    res.json({
      count: participants.length,
      participants,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =============================================================================
// BIDDING
// =============================================================================

// @desc    Place a bid on an auction
// @route   POST /api/auctions/:id/bid
// @access  Private (Buyer only)
const placeBid = async (req, res) => {
  try {
    const auctionId = req.params.id;
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount) {
      return res.status(400).json({ message: 'Bid amount is required' });
    }

    // Check auction exists
    const auctionCheck = await Auction.findById(auctionId);
    if (!auctionCheck) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Seller cannot bid on their own auction
    if (auctionCheck.sellerId.toString() === userId) {
      return res.status(403).json({ message: 'You cannot bid on your own auction' });
    }

    // Get user to retrieve email
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has joined the auction (by email)
    const hasJoined = await Participation.findOne({ auctionId, email: user.email });
    if (!hasJoined) {
      return res.status(403).json({ message: 'You must join the auction before bidding' });
    }

    // Check auction is active and time valid
    if (!auctionCheck.isActive || new Date() > new Date(auctionCheck.endDate)) {
      if (auctionCheck.isActive) {
        auctionCheck.isActive = false;
        await auctionCheck.save();
      }
      return res.status(400).json({ message: 'Auction is closed' });
    }

    if (amount <= auctionCheck.currentHighestBid) {
      return res.status(400).json({
        message: `Bid must be higher than the current highest bid (${auctionCheck.currentHighestBid})`,
      });
    }

    // Atomically update the auction (prevents race conditions)
    const updatedAuction = await Auction.findOneAndUpdate(
      {
        _id: auctionId,
        currentHighestBid: { $lt: amount },
        isActive: true,
      },
      {
        $set: {
          currentHighestBid: amount,
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

    // Save the bid record
    const bid = await Bid.create({
      auctionId,
      userId,
      amount,
    });

    res.status(201).json({
      message: 'Bid placed successfully',
      bid,
      auction: {
        currentHighestBid: updatedAuction.currentHighestBid,
        winnerId: updatedAuction.winnerId,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get bid history for an auction
// @route   GET /api/auctions/:id/bids
// @access  Public
const getBidHistory = async (req, res) => {
  try {
    const auctionId = req.params.id;

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const bids = await Bid.find({ auctionId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      count: bids.length,
      bids,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =============================================================================
// EXTEND AUCTION
// =============================================================================

// @desc    Extend an auction by 1 day
// @route   POST /api/auctions/:id/extend
// @access  Private (Seller owner only)
const extendAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Only the seller can extend their own auction
    if (auction.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the seller can extend the auction' });
    }

    // Check if auction is active before extending
    if (!auction.isActive) {
      return res.status(400).json({ message: 'Cannot extend an inactive auction' });
    }

    // Add 1 day to endDate
    const currentEndDate = new Date(auction.endDate);
    currentEndDate.setDate(currentEndDate.getDate() + 1);

    auction.endDate = currentEndDate;
    await auction.save();

    res.json({
      message: 'Auction extended successfully by 1 day',
      auction: {
        id: auction._id,
        newEndDate: auction.endDate,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// =============================================================================
// BUYER - My Auctions
// =============================================================================

// @desc    Get auctions the logged-in buyer has joined
// @route   GET /api/auctions/my-participations
// @access  Private
// (getMyParticipations moved to buyerController)

// =============================================================================
// AUCTION STATUS
// =============================================================================

// @desc    Close an auction manually (seller only)
// @route   POST /api/auctions/:id/close
// @access  Private (Seller owner only)
const closeAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    if (auction.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the seller can close the auction' });
    }

    if (!auction.isActive) {
      return res.status(400).json({ message: 'Auction is already closed' });
    }

    auction.isActive = false;
    await auction.save();

    // Get winner info
    let winner = null;
    if (auction.winnerId) {
      const User = require('../models/User');
      winner = await User.findById(auction.winnerId).select('name email');
    }

    res.json({
      message: 'Auction closed successfully',
      auction: {
        id: auction._id,
        isActive: auction.isActive,
        currentHighestBid: auction.currentHighestBid,
        winner,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  getSellerAuctions,
  joinAuction,
  getParticipants,
  placeBid,
  getBidHistory,
  extendAuction,
  closeAuction,
  enrichAuction,
  enrichAuctions,
};
