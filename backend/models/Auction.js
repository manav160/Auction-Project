const mongoose = require('mongoose');

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
    min:10
  },
  participantsCount: {
    type: Number,
    default: 0,
    min:0
  },
  endCondition: {
    type: String,
    enum: ['time', 'participants', 'either'],
    default: 'either'
  },
  autoDelete: {
    type: Boolean,
    default: false
  },
  extendedDays: {
    type: Number,
    default: 0,
    min:0
  },
  totalExtensionFeePaid: {
    type: Number,
    default: 0,
    min:0
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
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Indexes to optimize frequently used queries
auctionSchema.index({ sellerId: 1 });
auctionSchema.index({ isActive: 1 });
auctionSchema.index({ endDate: 1 });

module.exports = mongoose.model('Auction', auctionSchema);
