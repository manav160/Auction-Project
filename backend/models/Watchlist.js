const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Prevent duplicate watchlist entries for same user and auction
watchlistSchema.index(
  { userId: 1, auctionId: 1 },
  { unique: true }
);

// Fast lookup for user's watchlisted items
watchlistSchema.index({ userId: 1 });

module.exports = mongoose.model('Watchlist', watchlistSchema);
