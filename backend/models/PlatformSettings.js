const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'DEFAULT_SETTINGS'
  },
  premiumListingFee: {
    type: Number,
    required: true,
    default: 500,
    min: 0
  },
  standardCommissionPct: {
    type: Number,
    required: true,
    default: 8,
    min: 0,
    max: 100
  },
  premiumCommissionPct: {
    type: Number,
    required: true,
    default: 5,
    min: 0,
    max: 100
  },
  entryFeeCommissionPct: {
    type: Number,
    required: true,
    default: 20,
    min: 0,
    max: 100
  },
  extensionFee: {
    type: Number,
    required: true,
    default: 100,
    min: 0
  },
  maxEntryFee: {
    type: Number,
    required: true,
    default: 1000,
    min: 0
  },
  maxStandardParticipants: {
    type: Number,
    required: true,
    default: 15,
    min: 1
  },
  maxPremiumParticipants: {
    type: Number,
    required: true,
    default: 100,
    min: 1
  },
  featureFlags: {
    allowEntryFees: { type: Boolean, default: true },
    allowPremiumListings: { type: Boolean, default: true },
    allowAuctionExtensions: { type: Boolean, default: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
