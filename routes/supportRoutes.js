const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.use(protect);

// Any authenticated user (customer, waiter, kitchen, admin) can file a ticket.
router.post('/', supportController.createTicket);

// Any staff role can triage tickets — admin isn't always available,
// so waiter/kitchen can pick up and resolve complaints too.
router.get('/', restrictTo('admin', 'waiter', 'kitchen'), supportController.getAllTickets);
router.put('/:id', restrictTo('admin', 'waiter', 'kitchen'), supportController.updateTicket);

module.exports = router;