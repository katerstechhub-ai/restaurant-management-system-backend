const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.get('/', protect, tableController.getAllTables);
router.post('/', protect, restrictTo('admin'), tableController.addTable);
router.post('/walk-in', protect, restrictTo('admin', 'waiter'), tableController.assignTableWalkIn);
router.post('/auto-assign', protect, restrictTo('admin', 'waiter'), tableController.autoAssignTable);
router.post('/release', protect, restrictTo('admin', 'waiter'), tableController.releaseTable);
router.patch('/status', protect, restrictTo('admin'), tableController.updateTableStatus);

module.exports = router;