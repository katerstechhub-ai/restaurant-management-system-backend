const express = require('express');
const router = express.Router();
const {
  createOrder,
  verifyOrderPayment,
  getOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.post('/', protect, createOrder);
router.post('/:id/verify-payment', protect, verifyOrderPayment);
router.get('/', protect, getOrders);
router.get('/:id', protect, getOrderById);
router.patch('/:id/status', protect, restrictTo('admin', 'waiter', 'kitchen'), updateOrderStatus);

module.exports = router;