const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.get('/', protect, tableController.getAllTables);
router.post('/', protect, restrictTo('admin'), tableController.addTable);
router.post('/walk-in', protect, restrictTo('admin', 'staff'), tableController.assignTableWalkIn);
router.post('/auto-assign', protect, restrictTo('admin', 'staff'), tableController.autoAssignTable);

module.exports = router;
