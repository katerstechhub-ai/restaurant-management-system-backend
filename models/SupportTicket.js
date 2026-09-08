const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  // Set only when the ticket was filed by a logged-in customer through
  // self-service (as opposed to staff logging a complaint on a walk-in
  // customer's behalf, where there's no User account to reference).
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open' },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);