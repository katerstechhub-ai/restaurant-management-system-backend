const express = require('express');
const router = express.Router();
const {
  generateBill,
  processPayment,
  getTransactions,
  getTransactionById,
} = require('../controllers/billingController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.post('/:orderId', protect, restrictTo('admin', 'staff'), generateBill);
router.post('/:paymentId/pay', protect, processPayment);
router.get('/', protect, getTransactions);
router.get('/:paymentId', protect, getTransactionById);

module.exports = router;