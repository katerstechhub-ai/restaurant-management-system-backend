const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  extraCharges: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  method: { type: String, enum: ['cash', 'card', 'mobile'], required: true },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  transactionRef: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);