const express = require('express');
const router = express.Router();
const {
    getMenuItems,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
} = require('../controllers/menuController');
const { protect } = require('../middleware/authMiddleware');
const { restrictTo } = require('../middleware/roleMiddleware');

// Public — customers browse the menu without logging in
router.get('/', getMenuItems);
router.get('/:id', getMenuItemById);

// Admin only — create/edit/delete
router.post('/', protect, restrictTo('admin'), createMenuItem);
router.put('/:id', protect, restrictTo('admin'), updateMenuItem);
router.delete('/:id', protect, restrictTo('admin'), deleteMenuItem);

module.exports = router;