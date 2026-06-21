const express = require('express');
const router = express.Router();
const {
  getAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  getSellerAuctions,
  joinAuction,
  getParticipants,
  placeBid,
  getBidHistory,
  extendAuction,
  closeAuction
} = require('../controllers/auctionController');
const { protect } = require('../middleware/authMiddleware');

router.get('/seller', protect, getSellerAuctions);
router.get('/', getAuctions);
router.post('/', protect, createAuction);
router.get('/:id', getAuctionById);
router.put('/:id', protect, updateAuction);
router.delete('/:id', protect, deleteAuction);
router.post('/:id/close', protect, closeAuction);

// Join / Participate
router.post('/:id/join', protect, joinAuction);
router.get('/:id/participants', protect, getParticipants);

// Bids
router.post('/:id/bid', protect, placeBid);
router.get('/:id/bids', getBidHistory);

// Extend
router.post('/:id/extend', protect, extendAuction);

module.exports = router;
