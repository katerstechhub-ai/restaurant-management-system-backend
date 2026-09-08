const express = require('express');
const router = express.Router();
const { createUser, getAllUsers, updateUserRole } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

router.use(protect);
router.use(restrictTo('admin'));

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id/role', updateUserRole);

module.exports = router;