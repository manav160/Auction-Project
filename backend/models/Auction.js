const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  startingPrice: {
    type: Number,
    required: true
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
    default: 15
  },
  participantsCount: {
    type: Number,
    default: 0
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
    default: 0
  },
  totalExtensionFeePaid: {
    type: Number,
    default: 0
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

module.exports = mongoose.model('Auction', auctionSchema);
