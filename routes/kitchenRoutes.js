const express = require('express');
const router = express.Router();
const kitchenController = require('../controllers/kitchenController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(restrictTo('admin', 'staff'));

router.get('/queue', kitchenController.getKitchenQueue);
router.put('/orders/:id/status', kitchenController.updateOrderStatus);

module.exports = router;
