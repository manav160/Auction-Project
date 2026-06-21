const express = require('express');
const router = express.Router();
const { getJoinedAuctions, increaseBid } = require('../controllers/buyerController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/buyer/my-auctions - Get auctions the buyer has joined
router.get('/my-auctions', protect, getJoinedAuctions);

// POST /api/buyer/increase-bid - Increase bid
router.post('/increase-bid', protect, increaseBid);

module.exports = router;
