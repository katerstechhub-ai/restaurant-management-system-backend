const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(restrictTo('admin', 'staff'));

router.get('/', customerController.getAllCustomers);
router.get('/segments', customerController.getSegments);
router.get('/:id', customerController.getCustomerById);
router.put('/:id/preferences', customerController.updatePreferences);
router.post('/:id/feedback', customerController.addFeedback);

module.exports = router;