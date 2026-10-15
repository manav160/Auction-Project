const express = require('express');
const router = express.Router();
const { joinAuction, unjoinAuction } = require('../controllers/joinController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/join - Join an auction
router.post('/', protect, joinAuction);

// DELETE /api/join/:auctionId & POST /api/join/:auctionId/unjoin - Leave an auction
router.delete('/:auctionId', protect, unjoinAuction);
router.post('/:auctionId/unjoin', protect, unjoinAuction);

module.exports = router;

