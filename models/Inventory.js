const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true, unique: true },
  quantity: { type: Number, required: true, default: 0 },
  unit: { type: String, enum: ['kg', 'liters', 'pieces', 'packs'], default: 'kg' },
  reorderPoint: { type: Number, required: true },
  supplierInfo: { type: String },
  // Market cost per unit — tracked separately from Menu.price. This never
  // affects what a customer is charged; it's purely for margin visibility
  // (menu price stays whatever the admin set, regardless of ingredient
  // price swings).
  costPerUnit: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);