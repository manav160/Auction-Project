const express = require('express');
const router = express.Router();
const { getUsers, getAuctions } = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

router.get('/users', protect, admin, getUsers);
router.get('/auctions', protect, admin, getAuctions);

module.exports = router;
