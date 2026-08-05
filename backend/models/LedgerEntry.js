const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  type: {
    type: String,
    enum: ['DEBIT', 'CREDIT'],
    required: true
  },
  balanceType: {
    type: String,
    enum: ['AVAILABLE', 'LOCKED'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  }
}, { timestamps: true });

ledgerEntrySchema.index({ walletId: 1 });
ledgerEntrySchema.index({ transactionId: 1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
