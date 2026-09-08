const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'waiter', 'kitchen', 'customer'], default: 'customer' },
  walletBalance: { type: Number, default: 0 },
  // Optional — collected at registration, or later at checkout when a
  // delivery order needs one and the user doesn't have one on file yet.
  address: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);