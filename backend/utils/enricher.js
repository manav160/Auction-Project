const User = require("../models/User");
const Participation = require("../models/Participation");
const Bid = require("../models/Bid");
const Watchlist = require("../models/Watchlist");

const enrichAuction = async (auction, userId) => {
  try {
    if (!auction) return null;

    const auctionObj = auction.toObject ? auction.toObject() : { ...auction };

    const sellerObjId = auction.sellerId?._id || auction.sellerId;
    auctionObj.isOwner =
      userId && sellerObjId
        ? sellerObjId.toString() === userId.toString()
        : false;

    auctionObj.status = auction.status;
    auctionObj.minAllowedBid = (auction.currentHighestBid || auction.startingPrice || 0) + 100;
    auctionObj.isParticipated = false;
    auctionObj.isWatchlisted = false;
    auctionObj.userBid = null;

    if (userId) {
      const [participation, watchlist, userBid] = await Promise.all([
        Participation.findOne({
          auctionId: auction._id,
          userId: userId,
        }),

        Watchlist.findOne({
          auctionId: auction._id,
          userId: userId,
        }),

        Bid.findOne({
          auctionId: auction._id,
          userId: userId,
        }).sort({ amount: -1 }),
      ]);

      auctionObj.isParticipated = !!participation;
      auctionObj.isWatchlisted = !!watchlist;
      auctionObj.userBid = userBid ? userBid.amount : null;
    }

    return auctionObj;
  } catch (error) {
    console.error("Enricher Error:", error);
    return auction.toObject ? auction.toObject() : auction;
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