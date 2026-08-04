const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Participation = require('../models/Participation');
const User = require('../models/User');
const { enrichAuction, enrichAuctions } = require('../utils/enricher');
const { isValidObjectId } = require('mongoose');
const AuctionService = require('../services/auctionService');
const BiddingService = require('../services/biddingService');
const WalletService = require('../services/walletService');
const PlatformSettingsService = require('../services/platformSettingsService');

// =============================================================================
// AUCTION CRUD & SEARCH
// =============================================================================

// @desc    Get all auctions with multi-parametric advanced filters, search & pagination
// @route   GET /api/auctions
// @access  Public
const getAuctions = async (req, res) => {
  try {
    const { 
      status, 
      q, 
      search, 
      category, 
      condition, 
      listingType, 
      hasBuyNow, 
      entryFeeType, 
      minPrice, 
      maxPrice, 
      sort,
      page = 1,
      limit = 24
    } = req.query;

    const filter = {};

    if (status === 'active') {
      filter.status = 'ACTIVE';
    } else if (status === 'closed') {
      filter.status = { $in: ['PENDING_RESOLUTION', 'COMPLETED', 'UNSOLD', 'CANCELED'] };
    } else if (status && status !== 'all') {
      filter.status = status.toUpperCase();
    }

    if (listingType && listingType !== 'all') {
      filter.listingType = listingType.toUpperCase();
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (condition && condition !== 'all') {
      filter.condition = condition.toUpperCase();
    }

    if (hasBuyNow === 'true') {
      filter.buyNowPrice = { $ne: null, $gt: 0 };
    }

    if (entryFeeType === 'FREE') {
      filter.entryFee = 0;
    } else if (entryFeeType === 'PAID') {
      filter.entryFee = { $gt: 0 };
    }

    if (minPrice || maxPrice) {
      filter.startingPrice = {};
      if (minPrice) filter.startingPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.startingPrice.$lte = parseFloat(maxPrice);
    }

    const searchTerm = q || search;
    if (searchTerm) {
      filter.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    let sortOption = { listingType: -1, createdAt: -1 };
    if (sort === 'ending-soon') {
      sortOption = { endDate: 1 };
    } else if (sort === 'newest') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'highest-bid') {
      sortOption = { currentHighestBid: -1 };
    } else if (sort === 'buy-now-asc') {
      sortOption = { buyNowPrice: 1 };
    } else if (sort === 'buy-now-desc') {
      sortOption = { buyNowPrice: -1 };
    } else if (sort === 'most-participants') {
      sortOption = { participantsCount: -1 };
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 24;
    const skip = (pageNum - 1) * limitNum;

    const [auctions, totalCount] = await Promise.all([
      Auction.find(filter)
        .populate('sellerId', 'name email')
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum),
      Auction.countDocuments(filter)
    ]);

    const enrichedAuctions = await enrichAuctions(auctions, req.user?.id);

    res.json({
      auctions: enrichedAuctions,
      pagination: {
        total: totalCount,
        page: pageNum,
        pages: Math.ceil(totalCount / limitNum) || 1
      }
    });
  } catch (error) {
    console.error('getAuctions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single auction by ID
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

    const enrichedAuction = await enrichAuction(auction, req.user?.id);
    res.json(enrichedAuction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create an auction (Standard or Premium, optional Buy Now, Category & Condition)
// @route   POST /api/auctions
// @access  Private (Seller only)
const createAuction = async (req, res) => {
  const settings = await PlatformSettingsService.getSettings();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      title, 
      description, 
      startingPrice, 
      buyNowPrice,
      category = 'Other',
      condition = 'NEW',
      startDate, 
      endDate, 
      bidIncrementOptions, 
      maxParticipants, 
      endCondition,
      listingType = 'STANDARD',
      entryFee = 0
    } = req.body;

    if (!title || !description || startingPrice == null || !endDate) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    if (new Date(endDate) <= new Date()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'End date must be in the future' });
    }

    const numericStartingPrice = parseFloat(startingPrice);
    if (numericStartingPrice <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Starting price must be greater than 0' });
    }

    let numericBuyNowPrice = null;
    if (buyNowPrice != null && buyNowPrice !== '') {
      numericBuyNowPrice = parseFloat(buyNowPrice);
      if (numericBuyNowPrice <= numericStartingPrice) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Buy Now price (₹${numericBuyNowPrice}) must be greater than starting price (₹${numericStartingPrice})` });
      }
    }

    const numericEntryFee = parseFloat(entryFee) || 0;
    if (numericEntryFee < 0 || numericEntryFee > settings.maxEntryFee) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Entry fee must be between ₹0 and ₹${settings.maxEntryFee}` });
    }

    const isPremium = listingType.toUpperCase() === 'PREMIUM';
    const finalValueCommissionPct = isPremium ? settings.premiumCommissionPct : settings.standardCommissionPct;
    const allowedMaxParticipants = maxParticipants ? parseInt(maxParticipants) : (isPremium ? settings.maxPremiumParticipants : settings.maxStandardParticipants);

    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path;
    }

    const [auction] = await Auction.create([{
      title,
      description,
      startingPrice: numericStartingPrice,
      buyNowPrice: numericBuyNowPrice,
      category,
      condition,
      startDate: startDate ? new Date(startDate) : Date.now(),
      endDate,
      imageUrl,
      sellerId: req.user.id,
      bidIncrementOptions: bidIncrementOptions ? (Array.isArray(bidIncrementOptions) ? bidIncrementOptions : JSON.parse(bidIncrementOptions)) : [100, 500, 1000],
      maxParticipants: allowedMaxParticipants,
      endCondition: endCondition || 'either',
      listingType: isPremium ? 'PREMIUM' : 'STANDARD',
      premiumFeePaid: isPremium ? settings.premiumListingFee : 0,
      entryFee: numericEntryFee,
      finalValueCommissionPct,
      status: 'DRAFT'
    }], { session, ordered: true });

    if (isPremium) {
      await WalletService.payPremiumFee({
        sellerId: req.user.id,
        amount: settings.premiumListingFee,
        auctionId: auction._id
      }, session);
    }

    await session.commitTransaction();
    session.endSession();

    const startedAuction = await AuctionService.startAuction(auction._id);

    res.status(201).json(startedAuction || auction);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Create Auction Error:', error);
    res.status(400).json({ message: error.message || 'Server error creating auction' });
  }
};

// @desc    Execute Buy Now instant purchase
// @route   POST /api/auctions/:id/buynow
// @access  Private (Buyer only)
const buyNow = async (req, res) => {
  try {
    const auctionId = req.params.id;
    const buyerId = req.user.id;

    const completedAuction = await AuctionService.executeBuyNow({ auctionId, buyerId });

    res.json({
      success: true,
      message: 'Buy Now purchase completed successfully! You have won this item.',
      auction: completedAuction
    });
  } catch (error) {
    console.error('Buy Now Error:', error);
    res.status(400).json({ message: error.message || 'Failed to process Buy Now purchase' });
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

    if (auction.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this auction' });
    }

    const bidCount = await Bid.countDocuments({ auctionId: auction._id });
    if (bidCount > 0) {
      return res.status(400).json({ message: 'Cannot update auction after bids have been placed' });
    }

    const { title, description, startingPrice, buyNowPrice, category, condition, endDate, bidIncrementOptions } = req.body;

    if (title) auction.title = title;
    if (description) auction.description = description;
    if (category) auction.category = category;
    if (condition) auction.condition = condition;
    if (startingPrice) {
      if (startingPrice <= 0) {
        return res.status(400).json({ message: 'Starting price must be greater than 0' });
      }
      auction.startingPrice = startingPrice;
      auction.currentHighestBid = startingPrice;
    }
    if (buyNowPrice !== undefined) {
      auction.buyNowPrice = buyNowPrice ? parseFloat(buyNowPrice) : null;
    }
    if (endDate) {
      if (new Date(endDate) <= new Date()) {
        return res.status(400).json({ message: 'End date must be in the future' });
      }
      auction.endDate = endDate;
    }
    if (bidIncrementOptions) {
      auction.bidIncrementOptions = Array.isArray(bidIncrementOptions) ? bidIncrementOptions : JSON.parse(bidIncrementOptions);
    }
    if (req.body.maxParticipants) auction.maxParticipants = req.body.maxParticipants;
    if (req.body.startDate) auction.startDate = new Date(req.body.startDate);
    if (req.file) auction.imageUrl = req.file.path;

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

    if (auction.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this auction' });
    }

    const bidCount = await Bid.countDocuments({ auctionId: auction._id });
    if (bidCount > 0) {
      return res.status(400).json({ message: 'Cannot delete auction after bids have been placed' });
    }

    await Participation.deleteMany({ auctionId: auction._id });
    await Auction.deleteOne({ _id: req.params.id });

    res.json({ message: 'Auction deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get logged-in seller's auctions
// @route   GET /api/auctions/seller
// @access  Private (Seller only)
const getSellerAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find({ sellerId: req.user.id }).sort({ createdAt: -1 });
    const enrichedAuctions = await enrichAuctions(auctions, req.user.id);
    res.json(enrichedAuctions);
  } catch (error) {
    console.error('Error in getSellerAuctions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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

    res.json({ count: participants.length, participants });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

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

    const { auction: updatedAuction, bid } = await BiddingService.placeBid({
      auctionId,
      userId,
      amount: parseFloat(amount)
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
    console.error('AuctionController Bid Error:', error);
    res.status(400).json({ message: error.message || 'Failed to place bid' });
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
      .sort({ createdAt: -1 })
      .lean();

    res.json({ count: bids.length, bids });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Extend an auction by 1 day
// @route   POST /api/auctions/:id/extend
// @access  Private (Seller owner only)
const extendAuction = async (req, res) => {
  const settings = await PlatformSettingsService.getSettings();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const auction = await Auction.findById(req.params.id).session(session);

    if (!auction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Auction not found' });
    }

    if (auction.sellerId.toString() !== req.user.id) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Only the seller can extend the auction' });
    }

    if (auction.status !== 'ACTIVE') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Cannot extend an inactive auction' });
    }

    if (settings.extensionFee > 0) {
      await WalletService.payFee({
        userId: req.user.id,
        amount: settings.extensionFee,
        referenceType: 'EXTENSION_FEE',
        referenceId: auction._id,
        idempotencyKey: `extend-${auction._id}-${Date.now()}`,
        description: `Extension fee for auction: "${auction.title}"`
      }, session);
    }

    const currentEndDate = new Date(auction.endDate);
    currentEndDate.setDate(currentEndDate.getDate() + 1);

    auction.endDate = currentEndDate;
    auction.extendedDays = (auction.extendedDays || 0) + 1;
    auction.totalExtensionFeePaid = (auction.totalExtensionFeePaid || 0) + settings.extensionFee;
    auction.lastExtensionDate = new Date();
    auction.extensionHistory.push({
      days: 1,
      fee: settings.extensionFee,
      extendedAt: new Date()
    });

    await auction.save({ session });

    await session.commitTransaction();
    session.endSession();

    await AuctionService.scheduleAuctionEnd(auction);

    res.json({
      message: 'Auction extended successfully by 1 day',
      auction: {
        id: auction._id,
        newEndDate: auction.endDate,
        feePaid: settings.extensionFee
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(400).json({ message: error.message || 'Server error' });
  }
};

// @desc    Close / Cancel an auction manually
// @route   POST /api/auctions/:id/close
// @access  Private (Seller owner only)
const closeAuction = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid auction ID" });
    }

    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the seller can close the auction" });
    }

    if (auction.status !== 'ACTIVE' && auction.status !== 'SCHEDULED' && auction.status !== 'DRAFT') {
      return res.status(400).json({ message: "Auction is already closed or resolved" });
    }

    const updatedAuction = await AuctionService.cancelAuctionWithRefunds(auction._id, req.user.id);

    res.json({
      message: "Auction closed successfully and all entry fees refunded",
      auction: updatedAuction
    });
  } catch (error) {
    console.error('Close Auction Error:', error);
    res.status(400).json({ message: error.message || "Server error" });
  }
};

module.exports = {
  getAuctions,
  getAuctionById,
  createAuction,
  buyNow,
  updateAuction,
  deleteAuction,
  getSellerAuctions,
  getParticipants,
  placeBid,
  getBidHistory,
  extendAuction,
  closeAuction,
  enrichAuction,
  enrichAuctions,
};
