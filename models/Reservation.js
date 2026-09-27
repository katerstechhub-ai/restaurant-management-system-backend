const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
  date: { type: Date, required: true },
  timeSlot: { type: String, required: true },
  status: { type: String, enum: ['confirmed', 'cancelled', 'completed'], default: 'confirmed' },

  // Payment — same 3 methods as orders (wallet/paystack/bank_transfer).
  // The reservation still locks the slot immediately on booking (status
  // stays 'confirmed' right away, same as before) even while payment is
  // 'pending' for paystack/bank_transfer — this keeps the existing
  // double-booking index behavior unchanged rather than reworking it to
  // ignore unpaid holds.
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['wallet', 'paystack', 'bank_transfer'], default: 'wallet' },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  paystackReference: { type: String, unique: true, sparse: true },
}, { timestamps: true });

// Prevent double-booking: only one confirmed reservation per table/date/timeSlot
reservationSchema.index(
  { table: 1, date: 1, timeSlot: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } }
);

module.exports = mongoose.model('Reservation', reservationSchema);