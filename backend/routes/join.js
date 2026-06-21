const express = require('express');
const router = express.Router();
const { joinAuction, unjoinAuction } = require('../controllers/joinController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/join - Join an auction (auctionId in body)
router.post('/', protect, joinAuction);

// POST /api/join/:auctionId/unjoin - Leave an auction
router.post('/:auctionId/unjoin', protect, unjoinAuction);

module.exports = router;
