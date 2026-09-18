const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.get('/available', reservationController.getAvailableSlots);
router.get('/availability', reservationController.getTableAvailability);
router.get('/mine', protect, reservationController.getMyReservations);
router.get('/', protect, restrictTo('admin', 'waiter', 'kitchen'), reservationController.getAllReservations);
router.post('/', protect, reservationController.createReservation);
router.delete('/:id', protect, reservationController.cancelReservation);

module.exports = router;