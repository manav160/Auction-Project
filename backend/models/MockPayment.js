const mongoose = require('mongoose');

const mockPaymentSchema = new mongoose.Schema({
  auctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Auction',
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentType: {
    type: String,
    default: 'ExtensionFee'
  },
  status: {
    type: String,
    enum: ['Success', 'Failed'],
    default: 'Success'
  }
}, { timestamps: true });

module.exports = mongoose.model('MockPayment', mockPaymentSchema);
