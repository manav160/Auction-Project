const express = require('express');
const router = express.Router();
const { extendAuction } = require('../controllers/extendController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, extendAuction);

module.exports = router;
