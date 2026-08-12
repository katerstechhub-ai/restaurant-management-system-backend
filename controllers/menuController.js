const Menu = require('../models/Menu');

// @route  GET /api/menu
// Public — anyone can browse the menu
const getMenuItems = async (req, res) => {
    try {
        const items = await Menu.find().sort({ category: 1, name: 1 });
        res.status(200).json(items);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching menu items', error: err.message });
    }
};

// @route  GET /api/menu/:id
// Public
const getMenuItemById = async (req, res) => {
    try {
        const item = await Menu.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        res.status(200).json(item);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching menu item', error: err.message });
    }
};

// @route  POST /api/menu
// Admin only
const createMenuItem = async (req, res) => {
    try {
        const { name, description, price, category, available, image } = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({ message: 'Name and price are required' });
        }

        const item = await Menu.create({ name, description, price, category, available, image });
        res.status(201).json(item);
    } catch (err) {
        res.status(500).json({ message: 'Server error creating menu item', error: err.message });
    }
};

// @route  PUT /api/menu/:id
// Admin only
const updateMenuItem = async (req, res) => {
    try {
        const { name, description, price, category, available, image } = req.body;

        const item = await Menu.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Menu item not found' });
        }

        if (name !== undefined) item.name = name;
        if (description !== undefined) item.description = description;
        if (price !== undefined) item.price = price;
        if (category !== undefined) item.category = category;
        if (available !== undefined) item.available = available;
        if (image !== undefined) item.image = image;

        const updated = await item.save();
        res.status(200).json(updated);
    } catch (err) {
        res.status(500).json({ message: 'Server error updating menu item', error: err.message });
    }
};

// @route  DELETE /api/menu/:id
// Admin only
const deleteMenuItem = async (req, res) => {
    try {
        const item = await Menu.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Menu item not found' });
        }

        await item.deleteOne();
        res.status(200).json({ message: 'Menu item deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error deleting menu item', error: err.message });
    }
};

module.exports = {
    getMenuItems,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
};