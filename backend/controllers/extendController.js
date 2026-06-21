const Auction = require('../models/Auction');

// @desc    Extend an auction by 1 day
// @route   POST /api/extend/:id
// @access  Private (Seller owner only)
const extendAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    // Only the seller can extend their own auction
    if (auction.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the seller can extend the auction' });
    }

    // Check if auction is active before extending
    if (!auction.isActive) {
      return res.status(400).json({ message: 'Cannot extend an inactive auction' });
    }

    // Add 1 day to endDate
    const currentEndDate = new Date(auction.endDate);
    currentEndDate.setDate(currentEndDate.getDate() + 1);

    auction.endDate = currentEndDate;
    await auction.save();

    res.json({
      message: 'Auction extended successfully by 1 day',
      auction: {
        id: auction._id,
        newEndDate: auction.endDate,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  extendAuction,
};
