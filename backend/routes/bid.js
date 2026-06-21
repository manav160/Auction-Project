const express = require('express');
const router = express.Router();
const { placeBid, getBidHistory } = require('../controllers/bidController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/bid - Place a bid (auctionId in body)
router.post('/', protect, placeBid);

// GET /api/bid/:auctionId - Get bid history
router.get('/:auctionId', getBidHistory);

module.exports = router;
