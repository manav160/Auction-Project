const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true,
    required: true
  },
  availableBalance: {
    type: Number,
    required: true,
    min: 0,
    default: 15000 // Match initial simulation balance
  },
  lockedBalance: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  version: {
    type: Number,
    required: true,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
