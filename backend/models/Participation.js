const mongoose = require('mongoose');

const participationSchema = new mongoose.Schema({
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
  email: {
    type: String,
    required: true,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure the same email can only join an auction once
participationSchema.index({ auctionId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model('Participation', participationSchema);
