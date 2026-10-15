const Participation = require('../models/Participation');
const Watchlist = require('../models/Watchlist');

/**
 * Enriches a single auction object with user-specific context (isOwner, isParticipated, userBid, etc.)
 */
const enrichAuction = async (auction, userId) => {
  if (!auction) return null;
  const auctionObj = auction.toObject ? auction.toObject() : { ...auction };
  const sellerId = auction.sellerId?._id || auction.sellerId;

  auctionObj.isOwner = Boolean(userId && sellerId && sellerId.toString() === userId.toString());
  auctionObj.minAllowedBid = (auction.currentHighestBid || auction.startingPrice || 0) + 100;
  auctionObj.isParticipated = false;
  auctionObj.isWatchlisted = false;
  auctionObj.userBid = null;

  if (auction.bids?.length && userId) {
    const userBids = auction.bids.filter((b) => (b.userId?._id || b.userId)?.toString() === userId.toString());
    if (userBids.length > 0) auctionObj.userBid = Math.max(...userBids.map((b) => b.amount));
  }

  if (userId) {
    const [participation, watchlist] = await Promise.all([
      Participation.exists({ auctionId: auction._id, userId }),
      Watchlist.exists({ auctionId: auction._id, userId }),
    ]);
    auctionObj.isParticipated = Boolean(participation);
    auctionObj.isWatchlisted = Boolean(watchlist);
  }

  return auctionObj;
};

/**
 * Efficiently batch enriches a list of auctions with user context using 2 batch queries
 */
const enrichAuctions = async (auctions, userId) => {
  if (!auctions || auctions.length === 0) return [];

  const list = auctions.map((a) => (a.toObject ? a.toObject() : { ...a }));
  const auctionIds = list.map((a) => a._id);

  let participatedSet = new Set();
  let watchlistedSet = new Set();

  if (userId && auctionIds.length > 0) {
    const [participations, watchlists] = await Promise.all([
      Participation.find({ auctionId: { $in: auctionIds }, userId }).select('auctionId').lean(),
      Watchlist.find({ auctionId: { $in: auctionIds }, userId }).select('auctionId').lean(),
    ]);
    participatedSet = new Set(participations.map((p) => p.auctionId.toString()));
    watchlistedSet = new Set(watchlists.map((w) => w.auctionId.toString()));
  }

  return list.map((auction) => {
    const sellerId = auction.sellerId?._id || auction.sellerId;
    auction.isOwner = Boolean(userId && sellerId && sellerId.toString() === userId.toString());
    auction.minAllowedBid = (auction.currentHighestBid || auction.startingPrice || 0) + 100;
    auction.isParticipated = participatedSet.has(auction._id.toString());
    auction.isWatchlisted = watchlistedSet.has(auction._id.toString());

    if (auction.bids?.length && userId) {
      const userBids = auction.bids.filter((b) => (b.userId?._id || b.userId)?.toString() === userId.toString());
      auction.userBid = userBids.length > 0 ? Math.max(...userBids.map((b) => b.amount)) : null;
    } else {
      auction.userBid = null;
    }

    return auction;
  });
};

module.exports = { enrichAuction, enrichAuctions };