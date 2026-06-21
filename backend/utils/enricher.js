const Participation = require('../models/Participation');
const Bid = require('../models/Bid');

const enrichAuction = async (auction, userId) => {
  try {
    if (!auction) return null;
    console.log(`[Enricher] Processing auction: ${auction._id || auction.id} for user: ${userId}`);
    
    const auctionObj = auction.toObject ? auction.toObject() : JSON.parse(JSON.stringify(auction));
    
    // ID handling & Casting
    const mongoose = require('mongoose');
    let aId, uId, sId, userEmail;
    try {
      aId = (auction._id || auction.id || auctionObj._id) ? new mongoose.Types.ObjectId(auction._id || auction.id || auctionObj._id) : null;
      uId = userId ? new mongoose.Types.ObjectId(userId) : null;
      sId = auction.sellerId?._id || auction.sellerId;
      
      // Get user email if userId is provided
      if (userId) {
        const User = require('../models/User');
        const user = await User.findById(userId);
        userEmail = user ? user.email : null;
      }
    } catch (e) {
      console.error('[Enricher] ID Casting error:', e.message);
      return auctionObj; // Return partially enriched
    }
    
    // Basic flags
    auctionObj.isOwner = uId && sId ? sId.toString() === uId.toString() : false;
    
    // Status logic
    const now = new Date();
    const endDate = auction.endDate ? new Date(auction.endDate) : now;
    const isExpired = now > endDate;
    const isFull = (auction.participantsCount || 0) >= (auction.maxParticipants || 15);
    auctionObj.status = (auction.isActive && !isExpired && !isFull) ? 'Active' : 'Closed';
    
    // Bidding logic flags
    auctionObj.minAllowedBid = (auction.currentHighestBid || 0) + 100;
    
    // Participation & Bids
    if (uId && aId && userEmail) {
      const [participation, userBid] = await Promise.all([
        Participation.findOne({ auctionId: aId, email: userEmail }),
        Bid.findOne({ auctionId: aId, userId: uId }).sort({ amount: -1 })
      ]);
      
      auctionObj.isParticipated = !!participation;
      auctionObj.userBid = userBid ? userBid.amount : null;
    } else {
      auctionObj.isParticipated = false;
      auctionObj.userBid = null;
    }
    
    return auctionObj;
  } catch (error) {
    console.error('[Enricher] Critical error:', error);
    return auction.toObject ? auction.toObject() : auction; 
  }
};

const enrichAuctions = async (auctions, userId) => {
  if (!auctions || !Array.isArray(auctions)) return [];
  console.log(`[Enricher] Enriching ${auctions.length} auctions`);
  return Promise.all(auctions.map(a => enrichAuction(a, userId)));
};

module.exports = {
  enrichAuction,
  enrichAuctions,
};
