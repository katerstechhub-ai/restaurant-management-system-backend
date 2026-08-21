const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu', required: true },
    quantity: { type: Number, required: true },
    customizations: String,
  }],
  status: { type: String, enum: ['pending', 'preparing', 'ready', 'completed'], default: 'pending' },
  orderType: { type: String, enum: ['dine-in', 'delivery'], default: 'dine-in' },
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
  totalAmount: Number,
  paidWithWallet: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);