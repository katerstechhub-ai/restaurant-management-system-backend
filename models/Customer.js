const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  preferences: { type: [String], default: [] },
  feedback: [{
    comment: String,
    rating: { type: Number, min: 1, max: 5 },
    createdAt: { type: Date, default: Date.now },
  }],
  // Simple tiering for capstone scope — recomputed by segmentation logic in the controller.
  segment: { type: String, enum: ['new', 'regular', 'vip'], default: 'new' },
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);