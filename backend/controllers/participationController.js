const Participation = require('../models/Participation');
const Auction = require('../models/Auction');
const { enrichAuctions } = require('../utils/enricher');

// @desc    Get logged-in user's participations
// @route   GET /api/participations/me
// @access  Private
const getMyParticipations = async (req, res) => {
  try {
    const participations = await Participation.find({ userId: req.user.id })
      .populate({
        path: 'auctionId',
        populate: { path: 'sellerId', select: 'name email' },
      })
      .sort({ joinedAt: -1 });

    const auctions = participations
      .map((p) => p.auctionId)
      .filter(Boolean);

    const enrichedAuctions = await enrichAuctions(auctions, req.user.id);
    res.json(enrichedAuctions);
  } catch (error) {
    console.error('Error in getMyParticipations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Check if user has joined a specific auction
// @route   GET /api/participations/check/:auctionId
// @access  Private
const checkParticipation = async (req, res) => {
  try {
    const participation = await Participation.findOne({
      auctionId: req.params.auctionId,
      userId: req.user.id,
    });

    res.json({ joined: !!participation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get participants of a specific auction
// @route   GET /api/participations/:auctionId
// @access  Private
const getAuctionParticipants = async (req, res) => {
  try {
    const participants = await Participation.find({ auctionId: req.params.auctionId })
      .populate('userId', 'name email')
      .sort({ joinedAt: -1 });
    res.json(participants);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getMyParticipations,
  checkParticipation,
  getAuctionParticipants,
};
