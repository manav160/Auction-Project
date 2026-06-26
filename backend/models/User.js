const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],// User role can be either 'user' or 'admin'
    required: true,
    default: 'user',
  },
  walletBalance: {
    type: Number,
    default: 15000, // Default starting balance for simulation
  },
  lockedBalance: {// Balance that is locked due to active bids
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

});

module.exports = mongoose.model('User', userSchema);
