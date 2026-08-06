const express = require('express');
const router = express.Router();
const { toggleWatchlist, getWatchlist } = require('../controllers/watchlistController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getWatchlist);
router.post('/:auctionId/toggle', protect, toggleWatchlist);

module.exports = router;
