const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: String,
  available: { type: Boolean, default: true },
  image: { type: String, default: '' },
  prepTimeMinutes: { type: Number },
  // Optional recipe — which Inventory items (and how much of each) this dish
  // consumes per order. Empty/unset means this dish doesn't touch inventory
  // tracking at all (backward compatible with existing menu items).
  ingredients: [{
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
    quantityUsed: { type: Number, required: true },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);