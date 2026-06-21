const express = require('express');
const router = express.Router();
const { getMyParticipations, checkParticipation, getAuctionParticipants } = require('../controllers/participationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/me', protect, getMyParticipations);
router.get('/check/:auctionId', protect, checkParticipation);
// GET /api/participations/:auctionId - list all participants of an auction
router.get('/:auctionId', protect, getAuctionParticipants);

module.exports = router;
