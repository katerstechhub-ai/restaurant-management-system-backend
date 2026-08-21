const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(restrictTo('admin', 'staff'));

router.get('/sales-trends', reportController.getSalesTrends);
router.get('/top-dishes', reportController.getTopDishes);
router.post('/generate', reportController.generateReport);

module.exports = router;