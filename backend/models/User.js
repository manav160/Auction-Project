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
    select: false,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],// User role can be either 'user' or 'admin'
    required: true,
    default: 'user',
  },
  avatar: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

});

module.exports = mongoose.model('User', userSchema);
