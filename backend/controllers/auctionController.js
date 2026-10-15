const { isValidObjectId } = require('mongoose');
const Auction = require('../models/Auction');
const Participation = require('../models/Participation');
const { enrichAuction, enrichAuctions } = require('../utils/enricher');
const AuctionService = require('../services/auctionService');
const WalletService = require('../services/walletService');
const PlatformSettingsService = require('../services/platformSettingsService');
const { withTransaction } = require('../utils/transaction');
const { placeBid, getBidHistory } = require('./bidController');
const { extendAuction } = require('./extendController');

/**
 * Builds MongoDB query filter from request parameters
 */
const buildAuctionFilter = ({ status, q, search, category, condition, listingType, hasBuyNow, entryFeeType, minPrice, maxPrice }) => {
  const filter = {};

  if (status === 'active') filter.status = 'ACTIVE';
  else if (status === 'closed') filter.status = { $in: ['PENDING_RESOLUTION', 'COMPLETED', 'UNSOLD', 'CANCELED'] };
  else if (status && status !== 'all') filter.status = status.toUpperCase();

  if (listingType && listingType !== 'all') filter.listingType = listingType.toUpperCase();
  if (category && category !== 'all') filter.category = category;
  if (condition && condition !== 'all') filter.condition = condition.toUpperCase();
  if (hasBuyNow === 'true') filter.buyNowPrice = { $ne: null, $gt: 0 };
  if (entryFeeType === 'FREE') filter.entryFee = 0;
  if (entryFeeType === 'PAID') filter.entryFee = { $gt: 0 };

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

  return filter;
};

// @desc    Get all auctions with filters, search & pagination
// @route   GET /api/auctions
const getAuctions = async (req, res) => {
  try {
    const filter = buildAuctionFilter(req.query);
    const { page = 1, limit = 24, sort } = req.query;

    const sortOptions = {
      'ending-soon': { endDate: 1 },
      'newest': { createdAt: -1 },
      'highest-bid': { currentHighestBid: -1 },
      'buy-now-asc': { buyNowPrice: 1 },
      'buy-now-desc': { buyNowPrice: -1 },
      'most-participants': { participantsCount: -1 }
    };
    const sortOption = sortOptions[sort] || { listingType: -1, createdAt: -1 };

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 24;
    const skip = (pageNum - 1) * limitNum;

    const [auctions, totalCount] = await Promise.all([
      Auction.find(filter).populate('sellerId', 'name email').sort(sortOption).skip(skip).limit(limitNum),
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
const getAuctionById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid auction ID' });
    }

    const auction = await Auction.findById(req.params.id)
      .populate('sellerId', 'name email')
      .populate('winnerId', 'name email');

    if (!auction) return res.status(404).json({ message: 'Auction not found' });

    const enriched = await enrichAuction(auction, req.user?.id);
    res.json(enriched);
  } catch (error) {
    console.error('getAuctionById error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create an auction
// @route   POST /api/auctions
const createAuction = async (req, res) => {
  try {
    const settings = await PlatformSettingsService.getSettings();
    const {
      title, description, startingPrice, buyNowPrice, category = 'Other', condition = 'NEW',
      startDate, endDate, bidIncrementOptions, maxParticipants, endCondition,
      listingType = 'STANDARD', entryFee = 0
    } = req.body;

    if (!title || !description || startingPrice == null || !endDate) {
      return res.status(400).json({ message: 'Please add all required fields' });
    }

    if (new Date(endDate) <= new Date()) {
      return res.status(400).json({ message: 'End date must be in the future' });
    }

    const numericStartingPrice = parseFloat(startingPrice);
    if (numericStartingPrice <= 0) {
      return res.status(400).json({ message: 'Starting price must be greater than 0' });
    }

    let numericBuyNowPrice = null;
    if (buyNowPrice != null && buyNowPrice !== '') {
      numericBuyNowPrice = parseFloat(buyNowPrice);
      if (numericBuyNowPrice <= numericStartingPrice) {
        return res.status(400).json({
          message: `Buy Now price (₹${numericBuyNowPrice}) must be greater than starting price (₹${numericStartingPrice})`
        });
      }
    }

    const numericEntryFee = parseFloat(entryFee) || 0;
    if (numericEntryFee < 0 || numericEntryFee > settings.maxEntryFee) {
      return res.status(400).json({ message: `Entry fee must be between ₹0 and ₹${settings.maxEntryFee}` });
    }

    const isPremium = listingType.toUpperCase() === 'PREMIUM';
    const finalValueCommissionPct = isPremium ? settings.premiumCommissionPct : settings.standardCommissionPct;
    const allowedMaxParticipants = maxParticipants
      ? parseInt(maxParticipants, 10)
      : (isPremium ? settings.maxPremiumParticipants : settings.maxStandardParticipants);

    const imageUrl = req.file ? req.file.path : null;

    const auction = await withTransaction(async (session) => {
      const [newAuction] = await Auction.create([{
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
        bidIncrementOptions: bidIncrementOptions
          ? (Array.isArray(bidIncrementOptions) ? bidIncrementOptions : JSON.parse(bidIncrementOptions))
          : [100, 500, 1000],
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
          auctionId: newAuction._id
        }, session);
      }

      return newAuction;
    });

    const startedAuction = await AuctionService.startAuction(auction._id);
    res.status(201).json(startedAuction || auction);
  } catch (error) {
    console.error('Create Auction Error:', error);
    res.status(400).json({ message: error.message || 'Server error creating auction' });
  }
};

// @desc    Execute Buy Now instant purchase
// @route   POST /api/auctions/:id/buynow
const buyNow = async (req, res) => {
  try {
    const auctionId = req.params.id;
    const buyerId = req.user.id;
    const idempotencyKey = req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey;

    const completedAuction = await AuctionService.executeBuyNow({ auctionId, buyerId, idempotencyKey });

    res.json({
      success: true,
      message: 'Buy Now purchase completed successfully! You have won this item.',
      auction: completedAuction
    });
  } catch (error) {
    console.error('Buy Now Error:', error);
    const statusCode = error.statusCode || (error.message?.includes('no longer available') ? 409 : 400);
    res.status(statusCode).json({ message: error.message || 'Failed to process Buy Now purchase' });
  }
};

// @desc    Update an auction before bids are placed
// @route   PUT /api/auctions/:id
const updateAuction = async (req, res) => {
  try {
    const { title, description, startingPrice, buyNowPrice, category, condition, endDate, bidIncrementOptions } = req.body;
    const updateFields = {};

    if (title) updateFields.title = title;
    if (description) updateFields.description = description;
    if (category) updateFields.category = category;
    if (condition) updateFields.condition = condition;

    if (startingPrice !== undefined) {
      const parsedStart = parseFloat(startingPrice);
      if (isNaN(parsedStart) || parsedStart <= 0) {
        return res.status(400).json({ message: 'Starting price must be greater than 0' });
      }
      updateFields.startingPrice = parsedStart;
      updateFields.currentHighestBid = parsedStart;
    }

    if (buyNowPrice !== undefined) {
      updateFields.buyNowPrice = buyNowPrice ? parseFloat(buyNowPrice) : null;
    }

    if (endDate) {
      if (new Date(endDate) <= new Date()) {
        return res.status(400).json({ message: 'End date must be in the future' });
      }
      updateFields.endDate = new Date(endDate);
    }

    if (bidIncrementOptions) {
      updateFields.bidIncrementOptions = Array.isArray(bidIncrementOptions) ? bidIncrementOptions : JSON.parse(bidIncrementOptions);
    }

    if (req.body.maxParticipants) updateFields.maxParticipants = parseInt(req.body.maxParticipants, 10);
    if (req.body.startDate) updateFields.startDate = new Date(req.body.startDate);
    if (req.file) updateFields.imageUrl = req.file.path;

    const updatedAuction = await Auction.findOneAndUpdate(
      {
        _id: req.params.id,
        sellerId: req.user.id,
        $or: [{ bids: { $size: 0 } }, { bids: { $exists: false } }]
      },
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedAuction) {
      const existing = await Auction.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Auction not found' });
      if (existing.sellerId.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized to update this auction' });
      if ((existing.bids || []).length > 0) return res.status(400).json({ message: 'Cannot update auction after bids have been placed' });
      return res.status(400).json({ message: 'Failed to update auction' });
    }

    if (endDate) {
      await AuctionService.scheduleAuctionEnd(updatedAuction);
    }

    res.json(updatedAuction);
  } catch (error) {
    console.error('Update Auction Error:', error);
    if (error.name === 'VersionError') {
      return res.status(409).json({ message: 'Auction was updated concurrently. Please refresh and try again.' });
    }
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Delete an auction before bids are placed
// @route   DELETE /api/auctions/:id
const deleteAuction = async (req, res) => {
  try {
    await withTransaction(async (session) => {
      const auction = await Auction.findOne({
        _id: req.params.id,
        sellerId: req.user.id,
        $or: [{ bids: { $size: 0 } }, { bids: { $exists: false } }]
      }).session(session);

      if (!auction) {
        const existing = await Auction.findById(req.params.id);
        if (!existing) {
          const err = new Error('Auction not found');
          err.statusCode = 404;
          throw err;
        }
        if (existing.sellerId.toString() !== req.user.id) {
          const err = new Error('Not authorized to delete this auction');
          err.statusCode = 403;
          throw err;
        }
        if ((existing.bids || []).length > 0) {
          const err = new Error('Cannot delete auction after bids have been placed');
          err.statusCode = 400;
          throw err;
        }
        throw new Error('Failed to delete auction');
      }

      await Participation.deleteMany({ auctionId: auction._id }).session(session);
      await Auction.deleteOne({ _id: auction._id }).session(session);
    });

    AuctionService.cancelScheduledEnd(req.params.id);
    res.json({ message: 'Auction deleted successfully' });
  } catch (error) {
    console.error('Delete Auction Error:', error);
    res.status(error.statusCode || 500).json({ message: error.message || 'Server error' });
  }
};

// @desc    Get logged-in seller's auctions
// @route   GET /api/auctions/seller
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
const getParticipants = async (req, res) => {
  try {
    const auctionId = req.params.id;
    const auction = await Auction.findById(auctionId);
    if (!auction) return res.status(404).json({ message: 'Auction not found' });

    const participants = await Participation.find({ auctionId })
      .populate('userId', 'name email')
      .sort({ joinedAt: -1 });

    res.json({ count: participants.length, participants });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Close / Cancel an auction manually
// @route   POST /api/auctions/:id/close
const closeAuction = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid auction ID' });
    }

    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Auction not found' });

    if (auction.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the seller can close the auction' });
    }

    if (!['ACTIVE', 'SCHEDULED', 'DRAFT'].includes(auction.status)) {
      return res.status(400).json({ message: 'Auction is already closed or resolved' });
    }

    const updatedAuction = await AuctionService.cancelAuctionWithRefunds(auction._id, req.user.id);

    res.json({
      message: 'Auction closed successfully and all entry fees refunded',
      auction: updatedAuction
    });
  } catch (error) {
    console.error('Close Auction Error:', error);
    res.status(400).json({ message: error.message || 'Server error' });
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
};
