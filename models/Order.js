const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu', required: true },
    quantity: { type: Number, required: true },
    customizations: String,
  }],
  status: { type: String, enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'], default: 'pending' },
  orderType: { type: String, enum: ['dine-in', 'delivery'], default: 'dine-in' },
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
  totalAmount: Number,
  paidWithWallet: { type: Boolean, default: false },
  // Card-payment path (Paystack), separate rail from wallet payment.
  // paystackReference is unique+sparse so the same reference can never be
  // used to create two orders (mirrors WalletTransaction's reference guard).
  paidWithCard: { type: Boolean, default: false },
  paystackReference: { type: String, unique: true, sparse: true },
  // Snapshot of the address this order was placed against — only set for
  // delivery orders. Kept on the order (not just looked up from the user)
  // so a later profile-address change doesn't rewrite delivery history.
  deliveryAddress: { type: String },
  // True once ingredient stock has been deducted for this order — guards
  // against double-decrementing and tells cancellation whether there's
  // anything to restore.
  stockDecremented: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);