const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.use(protect);

// Any authenticated user (customer, staff, admin) can file a ticket.
router.post('/', supportController.createTicket);

// Only staff/admin can view and triage the full ticket list.
router.get('/', restrictTo('admin', 'staff'), supportController.getAllTickets);
router.put('/:id', restrictTo('admin', 'staff'), supportController.updateTicket);

module.exports = router;