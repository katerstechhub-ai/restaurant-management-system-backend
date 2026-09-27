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
    // `unit` and `costPerUnit` were previously dropped here even though the
    // model defines both — every new item silently defaulted to 'kg' and
    // costPerUnit 0 no matter what was submitted. Fixed.
    const { itemName, quantity, unit, reorderPoint, supplierInfo, costPerUnit } = req.body;
    const newItem = new Inventory({ itemName, quantity, unit, reorderPoint, supplierInfo, costPerUnit });
    await newItem.save();
    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type, reorderPoint } = req.body;

    const item = await Inventory.findById(id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (type === 'add') {
      item.quantity += amount;
    } else if (type === 'subtract') {
      item.quantity -= amount;
      if (item.quantity < 0) item.quantity = 0;
    } else if (reorderPoint !== undefined) {
      item.reorderPoint = reorderPoint;
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

// @route  PATCH /api/inventory/:id/cost
// Updates just the market cost-per-unit for an ingredient — separate from
// stock quantity movements (updateStock above). This is the number that
// moves with market prices; it never touches Menu.price.
exports.updateCost = async (req, res) => {
  try {
    const { id } = req.params;
    const { costPerUnit } = req.body;

    if (costPerUnit === undefined || Number(costPerUnit) < 0) {
      return res.status(400).json({ message: 'costPerUnit must be a non-negative number' });
    }

    const item = await Inventory.findById(id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.costPerUnit = Number(costPerUnit);
    await item.save();

    res.json({ message: 'Cost updated', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};