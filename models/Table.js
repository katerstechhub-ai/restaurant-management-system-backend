const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tableNumber: { type: Number, required: true, unique: true },
  capacity: { type: Number, required: true },
  status: { type: String, enum: ['available', 'reserved', 'occupied'], default: 'available' },
  // Floor-plan position (percentage-based, 0-100, so the layout scales with the container)
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  shape: { type: String, enum: ['round', 'square'], default: 'square' }
}, { timestamps: true });

module.exports = mongoose.model('Table', tableSchema);