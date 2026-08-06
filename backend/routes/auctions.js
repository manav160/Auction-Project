const express = require('express');
const router = express.Router();
const {
  getAuctions,
  getAuctionById,
  createAuction,
  buyNow,
  updateAuction,
  deleteAuction,
  getSellerAuctions,
  getParticipants,
  placeBid,
  getBidHistory,
  extendAuction,
  closeAuction
} = require('../controllers/auctionController');
const { joinAuction, unjoinAuction } = require('../controllers/joinController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/seller', protect, getSellerAuctions);
router.get('/', optionalAuth, getAuctions);
router.post('/', protect, upload.single('image'), createAuction);
router.get('/:id', optionalAuth, getAuctionById);
router.put('/:id', protect, upload.single('image'), updateAuction);
router.delete('/:id', protect, deleteAuction);
router.post('/:id/close', protect, closeAuction);

// Buy Now
router.post('/:id/buynow', protect, buyNow);

// Join / Participate / Unjoin
router.post('/:id/join', protect, joinAuction);
router.delete('/:id/join', protect, unjoinAuction);
router.get('/:id/participants', protect, getParticipants);

// Bids
router.post('/:id/bid', protect, placeBid);
router.get('/:id/bids', getBidHistory);

// Extend
router.post('/:id/extend', protect, extendAuction);

module.exports = router;
