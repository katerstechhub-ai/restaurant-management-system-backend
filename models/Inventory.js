const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true, default: 0 },
  unit: { type: String, enum: ['kg', 'liters', 'pieces', 'packs'], default: 'kg' },
  reorderPoint: { type: Number, required: true },
  supplierInfo: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);