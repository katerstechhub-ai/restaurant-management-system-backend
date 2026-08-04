const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: String,
  available: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);