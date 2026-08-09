const mongoose = require('mongoose');

// Embedded sub-schema for bids stored inside each auction document
const embeddedBidSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isBuyNow: {
    type: Boolean,
    default: false
  }
}, { _id: true });

const auctionSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    maxlength: 150,
    required: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    required: true
  },
  imageUrl: {
    type: String,
    default: null
  },
  category: {
    type: String,
    enum: ['Electronics', 'Collectibles', 'Fashion', 'Home', 'Motors', 'Other'],
    default: 'Other'
  },
  condition: {
    type: String,
    enum: ['NEW', 'LIKE_NEW', 'USED', 'REFURBISHED'],
    default: 'NEW'
  },
  startingPrice: {
    type: Number,
    required: true,
    min: 10
  },
  currentHighestBid: {
    type: Number,
    default: function() {
      return this.startingPrice;
    }
  },
  buyNowPrice: {
    type: Number,
    default: null,
    min: 0
  },
  buyNowPurchased: {
    type: Boolean,
    default: false
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  winnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  bidIncrementOptions: {
    type: [Number],
    default: [100, 500, 1000]
  },
  maxParticipants: {
    type: Number,
    default: 15,
    min: 1
  },
  participantsCount: {
    type: Number,
    default: 0,
    min: 0
  },
  endCondition: {
    type: String,
    enum: ['time', 'participants', 'either'],
    default: 'either'
  },
  // Business Model Fields
  listingType: {
    type: String,
    enum: ['STANDARD', 'PREMIUM'],
    default: 'STANDARD'
  },
  premiumFeePaid: {
    type: Number,
    default: 0,
    min: 0
  },
  entryFee: {
    type: Number,
    default: 0,
    min: 0
  },
  finalValueCommissionPct: {
    type: Number,
    default: 8,
    min: 0,
    max: 100
  },
  totalEntryFeesCollected: {
    type: Number,
    default: 0,
    min: 0
  },
  extendedDays: {
    type: Number,
    default: 0,
    min: 0
  },
  totalExtensionFeePaid: {
    type: Number,
    default: 0,
    min: 0
  },
  lastExtensionDate: {
    type: Date,
    default: null
  },
  extensionHistory: [{
    days: Number,
    fee: Number,
    extendedAt: Date
  }],
  // Embedded bids array — all bids for this auction live here
  bids: [embeddedBidSchema],
  status: {
    type: String,
    enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PENDING_RESOLUTION', 'COMPLETED', 'CANCELED', 'UNSOLD'],
    default: 'DRAFT'
  }
}, { timestamps: true, optimisticConcurrency: true });

// Text search index
auctionSchema.index({ title: 'text', description: 'text' });

// Compound & Query Optimization Indexes
auctionSchema.index({ listingType: -1, createdAt: -1 });
auctionSchema.index({ sellerId: 1 });
auctionSchema.index({ status: 1 });
auctionSchema.index({ category: 1, status: 1 });
auctionSchema.index({ condition: 1 });
auctionSchema.index({ buyNowPrice: 1 });
auctionSchema.index({ endDate: 1 });

module.exports = mongoose.model('Auction', auctionSchema);
