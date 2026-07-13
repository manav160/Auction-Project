const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  auctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 10
  }
}, {
  timestamps: true
});

// Query all bids for an auction, usually sorted by amount
bidSchema.index({ auctionId: 1, amount: -1 });

// Query a user's bidding history
bidSchema.index({ userId: 1 });

module.exports = mongoose.model('Bid', bidSchema);