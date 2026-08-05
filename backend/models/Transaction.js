const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  referenceType: {
    type: String,
    enum: [
      'BID', 
      'AUCTION_FINALIZATION', 
      'JOIN', 
      'DEPOSIT', 
      'WITHDRAWAL', 
      'REFUND', 
      'EXTENSION_FEE',
      'PREMIUM_LISTING_FEE',
      'ENTRY_FEE_PAYMENT',
      'ENTRY_FEE_REFUND',
      'ENTRY_FEE_PAYOUT',
      'PLATFORM_COMMISSION',
      'BUY_NOW_PAYMENT'
    ],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  idempotencyKey: {
    type: String,
    unique: true,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

transactionSchema.index({ referenceType: 1, referenceId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
