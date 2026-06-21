const User = require('../models/User');
const Auction = require('../models/Auction');

const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find({}).populate('sellerId', 'name email');
    res.json(auctions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUsers,
  getAuctions
};
