/**
 * @deprecated — Bids are now embedded inside Auction.bids[].
 * This model is retained only for migration of legacy data.
 * Do NOT use in new code paths.
 */
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
  },
  isBuyNow: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Query all bids for an auction, usually sorted by amount
bidSchema.index({ auctionId: 1, amount: -1 });

// Query a user's bidding history
bidSchema.index({ userId: 1 });

module.exports = mongoose.model('Bid', bidSchema);