const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['topup', 'deduct'], required: true },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  method: { type: String, enum: ['card', 'mobile', 'cash'], default: 'card' },
  description: { type: String, default: '' },
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
}, { timestamps: true });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);