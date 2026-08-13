const express = require('express');
const router = express.Router();
const { getUploadSignature } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.get('/signature', protect, restrictTo('admin'), getUploadSignature);

module.exports = router;