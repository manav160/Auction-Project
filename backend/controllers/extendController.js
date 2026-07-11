const Auction = require('../models/Auction');
const MockPayment = require('../models/MockPayment');

// @desc    Extend an auction
// @route   POST /api/extend
// @access  Private (Seller owner only)
const extendAuction = async (req, res) => {
  try {
    const { auctionId, days } = req.body;
    const parsedDays = parseInt(days, 10);

    if (!parsedDays || parsedDays < 1 || parsedDays > 7) {
      return res.status(400).json({ message: 'Extension days must be between 1 and 7' });
    }

    const auction = await Auction.findById(auctionId || req.params.id);

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

    if (auction.extendedDays + parsedDays > 7) {
      return res.status(400).json({ 
        message: `Total extension limit exceeded. You can only extend for a maximum of ${7 - auction.extendedDays} more days.` 
      });
    }

    // Calculate fee
    const fee = parsedDays * Math.max(10, 0.01 * auction.currentHighestBid);

    // Mock payment
    await MockPayment.create({
      auctionId: auction._id,
      sellerId: req.user.id,
      amount: fee,
      status: 'Success'
    });

    // Add days to endDate
    const currentEndDate = new Date(auction.endDate);
    currentEndDate.setDate(currentEndDate.getDate() + parsedDays);

    auction.endDate = currentEndDate;
    auction.extendedDays += parsedDays;
    auction.totalExtensionFeePaid += fee;
    auction.lastExtensionDate = new Date();
    auction.extensionHistory.push({
      days: parsedDays,
      fee,
      extendedAt: new Date()
    });

    await auction.save();

    res.json({
      message: `Auction extended successfully by ${parsedDays} day(s)`,
      fee,
      extendedDays: auction.extendedDays,
      newEndDate: auction.endDate
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  extendAuction,
};
