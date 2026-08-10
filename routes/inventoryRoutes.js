const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(restrictTo('admin', 'staff'));

router.get('/', inventoryController.getAllInventory);
router.post('/', inventoryController.addInventoryItem);
router.put('/:id/stock', inventoryController.updateStock);

module.exports = router;
