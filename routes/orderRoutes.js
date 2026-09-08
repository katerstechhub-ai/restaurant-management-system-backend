const express = require('express');
const router = express.Router();
const {
  createOrder,
  payOrderWithCard,
  getOrders,
  getOrderById,
  updateOrderStatus,
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.post('/', protect, createOrder);
router.post('/pay', protect, payOrderWithCard);
router.get('/', protect, getOrders);
router.get('/:id', protect, getOrderById);
router.patch('/:id/status', protect, restrictTo('admin', 'waiter', 'kitchen'), updateOrderStatus);

module.exports = router;