const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu', required: true },
    quantity: { type: Number, required: true },
    customizations: String,
  }],
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending',
  },
  orderType: { type: String, enum: ['dine-in', 'delivery'], default: 'dine-in' },
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
  totalAmount: Number,

  // Payment — was wallet-only (paidWithWallet boolean). Now any order can be
  // paid by wallet, Paystack (card, via the same inline integration wallet
  // top-up already uses), or bank transfer.
  paymentMethod: { type: String, enum: ['wallet', 'paystack', 'bank_transfer'], default: 'wallet' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  // Kept for backward compatibility with any code still reading this field directly.
  paidWithWallet: { type: Boolean, default: false },
  // Paystack's transaction reference — unique + sparse so wallet-paid and
  // bank-transfer orders (which have none) don't collide on null.
  paystackReference: { type: String, unique: true, sparse: true },

  // Per-stage timestamps — lets the customer see not just the current
  // status but when each stage happened, for order tracking.
  preparingAt: Date,
  readyAt: Date,
  completedAt: Date,
  cancelledAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);