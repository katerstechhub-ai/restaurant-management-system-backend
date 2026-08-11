const express = require('express');
const router = express.Router();
const reservationController = require('../controllers/reservationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/available', reservationController.getAvailableSlots);
router.post('/', protect, reservationController.createReservation);
router.delete('/:id', protect, reservationController.cancelReservation);

module.exports = router;
