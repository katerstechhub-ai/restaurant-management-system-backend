const Menu = require('../models/Menu');

// Sums costPerUnit × quantityUsed across a dish's recipe. Requires
// `ingredients.inventoryItem` to be populated with at least `costPerUnit`.
// Returns null for dishes with no recipe defined (nothing to estimate) —
// distinct from 0, which would mean "recipe defined, costs to zero."
function computeEstimatedCost(menuItem) {
  if (!Array.isArray(menuItem.ingredients) || menuItem.ingredients.length === 0) {
    return null;
  }
  const total = menuItem.ingredients.reduce((sum, ing) => {
    const costPerUnit = ing.inventoryItem?.costPerUnit ?? 0;
    return sum + costPerUnit * ing.quantityUsed;
  }, 0);
  return Number(total.toFixed(2));
}

async function withEstimatedCost(menuItem) {
  await menuItem.populate('ingredients.inventoryItem', 'itemName unit costPerUnit');
  const obj = menuItem.toObject();
  obj.estimatedCost = computeEstimatedCost(menuItem);
  return obj;
}

// @route  GET /api/menu
// Public — anyone can browse the menu
const getMenuItems = async (req, res) => {
    try {
        const items = await Menu.find()
            .sort({ category: 1, name: 1 })
            .populate('ingredients.inventoryItem', 'itemName unit costPerUnit');

        const withCost = items.map((item) => {
            const obj = item.toObject();
            obj.estimatedCost = computeEstimatedCost(item);
            return obj;
        });

        res.status(200).json(withCost);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching menu items', error: err.message });
    }
};

// @route  GET /api/menu/:id
// Public
const getMenuItemById = async (req, res) => {
    try {
        const item = await Menu.findById(req.params.id)
            .populate('ingredients.inventoryItem', 'itemName unit costPerUnit');
        if (!item) {
            return res.status(404).json({ message: 'Menu item not found' });
        }
        const obj = item.toObject();
        obj.estimatedCost = computeEstimatedCost(item);
        res.status(200).json(obj);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching menu item', error: err.message });
    }
};

// @route  POST /api/menu
// Admin only
// `ingredients` is optional — [{ inventoryItem: <id>, quantityUsed: <number> }].
// Dishes with no ingredients array are unaffected (no inventory decrement,
// no estimated cost) — same as before this recipe concept existed.
const createMenuItem = async (req, res) => {
    try {
        const { name, description, price, category, available, image, prepTimeMinutes, ingredients } = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({ message: 'Name and price are required' });
        }

        const item = await Menu.create({ name, description, price, category, available, image, prepTimeMinutes, ingredients });
        const obj = await withEstimatedCost(item);
        res.status(201).json(obj);
    } catch (err) {
        res.status(500).json({ message: 'Server error creating menu item', error: err.message });
    }
};

// @route  PUT /api/menu/:id
// Admin only
const updateMenuItem = async (req, res) => {
    try {
        const { name, description, price, category, available, image, prepTimeMinutes, ingredients } = req.body;

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
        if (prepTimeMinutes !== undefined) item.prepTimeMinutes = prepTimeMinutes;
        // Replaces the whole recipe when provided (including an empty array,
        // which intentionally clears it) — matches how the admin form below
        // always submits its full current ingredient list, not a diff.
        if (ingredients !== undefined) item.ingredients = ingredients;

        const updated = await item.save();
        const obj = await withEstimatedCost(updated);
        res.status(200).json(obj);
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