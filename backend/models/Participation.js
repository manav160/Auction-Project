const mongoose = require('mongoose');

const participationSchema = new mongoose.Schema(
  {
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auction',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    entryFeePaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// A user can join a particular auction only once
participationSchema.index(
  { auctionId: 1, userId: 1 },
  { unique: true }
);

// Fast lookup: "Which auctions has this user joined?"
participationSchema.index({ userId: 1 });

module.exports = mongoose.model('Participation', participationSchema);