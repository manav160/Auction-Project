const User = require("../models/User");
const Participation = require("../models/Participation");
const Bid = require("../models/Bid");

const enrichAuction = async (auction, userId) => {
  try {
    if (!auction) return null;

    // Convert Mongoose document to normal JavaScript object
    const auctionObj = auction.toObject();

    // Check if current user is the owner
    auctionObj.isOwner =
      userId && auction.sellerId
        ? auction.sellerId.toString() === userId.toString()
        : false;

    // Calculate auction status
    const now = new Date();
    const isExpired = now > auction.endDate;
    const isFull =
      auction.participantsCount >= auction.maxParticipants;

    auctionObj.status =
      auction.isActive && !isExpired && !isFull
        ? "Active"
        : "Closed";

    // Minimum next bid
    auctionObj.minAllowedBid = auction.currentHighestBid + 100;

    // Default values to prevent undefined value in isparticipated and userBid
    auctionObj.isParticipated = false;
    auctionObj.userBid = null;

    // If user is logged in, fetch participation and highest bid
    if (userId) {
      const user = await User.findById(userId);

      if (user) {
        const [participation, userBid] = await Promise.all([
          Participation.findOne({
            auctionId: auction._id,
            email: user.email,
          }),

          Bid.findOne({
            auctionId: auction._id,
            userId: userId,
          }).sort({ amount: -1 }),
        ]);

        auctionObj.isParticipated = !!participation;
        auctionObj.userBid = userBid ? userBid.amount : null;
      }
    }

    return auctionObj;
  } catch (error) {
    console.error("Enricher Error:", error);
    return auction.toObject();
  }
};

const enrichAuctions = async (auctions, userId) => {
  if (!auctions || auctions.length === 0) return [];

  return Promise.all(
    auctions.map((auction) => enrichAuction(auction, userId))
  );
};

module.exports = {
  enrichAuction,
  enrichAuctions,
};