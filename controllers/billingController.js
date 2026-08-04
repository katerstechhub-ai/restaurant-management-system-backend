const Payment = require('../models/Payment');
const Order = require('../models/Order');

// @route  POST /api/billing/:orderId
// Generate a bill for an order — staff/admin, with optional discount/extra charges
const generateBill = async (req, res) => {
  try {
    const { discount = 0, extraCharges = 0, method } = req.body;
    const validMethods = ['cash', 'card', 'mobile'];

    if (!validMethods.includes(method)) {
      return res.status(400).json({ message: `Payment method must be one of: ${validMethods.join(', ')}` });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const existing = await Payment.findOne({ order: order._id });
    if (existing) {
      return res.status(409).json({ message: 'A bill already exists for this order', payment: existing });
    }

    const subtotal = order.totalAmount;
    const totalAmount = Math.max(subtotal - discount + extraCharges, 0);

    const payment = await Payment.create({
      order: order._id,
      customer: order.customer,
      subtotal,
      discount,
      extraCharges,
      totalAmount,
      method,
      status: 'pending',
    });

    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error generating bill', error: err.message });
  }
};

// @route  POST /api/billing/:paymentId/pay
// Stub payment processor — marks payment as paid, generates a fake transaction ref
const processPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status === 'paid') {
      return res.status(409).json({ message: 'Payment has already been processed' });
    }

    // Stub gateway — real integration (Paystack/Flutterwave/Stripe) would go here
    payment.status = 'paid';
    payment.transactionRef = `TXN-${Date.now()}-${payment._id.toString().slice(-6)}`;
    const updated = await payment.save();

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error processing payment', error: err.message });
  }
};

// @route  GET /api/billing
// Transaction history — staff/admin see all, customers see only their own
const getTransactions = async (req, res) => {
  try {
    const filter = req.user.role === 'customer' ? { customer: req.user._id } : {};

    const payments = await Payment.find(filter)
      .populate('order')
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(payments);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching transactions', error: err.message });
  }
};

// @route  GET /api/billing/:paymentId
const getTransactionById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId)
      .populate('order')
      .populate('customer', 'name email');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (req.user.role === 'customer' && payment.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this transaction' });
    }

    res.status(200).json(payment);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching transaction', error: err.message });
  }
};

module.exports = { generateBill, processPayment, getTransactions, getTransactionById };