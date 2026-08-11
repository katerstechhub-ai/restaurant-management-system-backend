const Inventory = require('../models/Inventory');

exports.getAllInventory = async (req, res) => {
  try {
    const inventory = await Inventory.find().sort({ itemName: 1 });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addInventoryItem = async (req, res) => {
  try {
    const { itemName, quantity, reorderPoint, supplierInfo } = req.body;
    const newItem = new Inventory({ itemName, quantity, reorderPoint, supplierInfo });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type } = req.body; // type can be 'add' or 'subtract'

    const item = await Inventory.findById(id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (type === 'add') {
      item.quantity += amount;
    } else if (type === 'subtract') {
      item.quantity -= amount;
      if (item.quantity < 0) item.quantity = 0;
    } else {
      return res.status(400).json({ message: 'Invalid movement type' });
    }

    await item.save();

    // Check for low stock
    if (item.quantity < item.reorderPoint) {
      console.log(`ALERT: Low stock for ${item.itemName}. Current quantity: ${item.quantity}`);
    }

    res.json({ message: 'Stock updated', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
