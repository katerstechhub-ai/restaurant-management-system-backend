const axios = require('axios');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Menu = require('../models/Menu');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

// Bank transfer details shown to the customer at checkout.
// Fill these in with your actual restaurant bank account details.
const BANK_DETAILS = {
  bankName: 'GTBank',
  accountNumber: '0123456789',
  accountName: 'Rustico Restaurant',
};

// @route  POST /api/orders
// Authenticated users (customer/staff) can place an order.
// paymentMethod: 'wallet' | 'paystack' | 'bank_transfer'
// - wallet: deducted immediately, same transaction-safe logic as before
// - paystack: order created as pending-payment; frontend opens the Paystack
//   inline popup right after using the returned order's totalAmount, then
//   calls POST /:id/verify-payment once Paystack confirms
// - bank_transfer: order created as pending-payment; frontend shows the
//   returned bankDetails; staff manually confirms once the transfer lands
const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { items, orderType, table, paymentMethod } = req.body;
    const resolvedOrderType = orderType || 'dine-in';
    const resolvedPaymentMethod = ['wallet', 'paystack', 'bank_transfer'].includes(paymentMethod)
      ? paymentMethod
      : 'wallet';

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must include at least one item' });
    }

    // Validate menu items exist and calculate total server-side (never trust client-sent prices)
    let totalAmount = 0;
    const resolvedItems = [];

    for (const entry of items) {
      const menuItem = await Menu.findById(entry.menuItem);
      if (!menuItem) {
        return res.status(404).json({ message: `Menu item not found: ${entry.menuItem}` });
      }
      if (!menuItem.available) {
        return res.status(400).json({ message: `Menu item unavailable: ${menuItem.name}` });
      }

      const quantity = entry.quantity || 1;
      totalAmount += menuItem.price * quantity;

      resolvedItems.push({
        menuItem: menuItem._id,
        quantity,
        customizations: entry.customizations || '',
      });
    }

    let order;

    if (resolvedPaymentMethod === 'wallet') {
      session.startTransaction();
      try {
        const user = await User.findById(req.user._id).session(session);

        if (user.walletBalance < totalAmount) {
          await session.abortTransaction();
          return res.status(402).json({
            message: 'Insufficient wallet balance',
            balance: user.walletBalance,
            required: totalAmount,
            shortfall: Number((totalAmount - user.walletBalance).toFixed(2)),
          });
        }

        user.walletBalance -= totalAmount;
        await user.save({ session });

        const createdOrders = await Order.create(
          [{
            customer: req.user._id,
            items: resolvedItems,
            orderType: resolvedOrderType,
            table: table || undefined,
            totalAmount,
            paymentMethod: 'wallet',
            paymentStatus: 'paid',
            paidWithWallet: true,
          }],
          { session }
        );
        order = createdOrders[0];

        await WalletTransaction.create(
          [{
            user: user._id,
            type: 'deduction',
            amount: totalAmount,
            balanceAfter: user.walletBalance,
            method: 'wallet',
            description: `Payment for order #${order._id.toString().slice(-6)}`,
          }],
          { session }
        );

        await session.commitTransaction();
      } catch (txErr) {
        await session.abortTransaction();
        throw txErr;
      } finally {
        session.endSession();
      }
    } else {
      // paystack or bank_transfer — order exists, payment is pending until
      // verified (paystack) or manually confirmed by staff (bank_transfer)
      session.endSession(); // not used on this path
      order = await Order.create({
        customer: req.user._id,
        items: resolvedItems,
        orderType: resolvedOrderType,
        table: table || undefined,
        totalAmount,
        paymentMethod: resolvedPaymentMethod,
        paymentStatus: 'pending',
        paidWithWallet: false,
      });
    }

    const response = order.toObject();
    if (resolvedPaymentMethod === 'bank_transfer') {
      response.bankDetails = BANK_DETAILS;
    }

    res.status(201).json(response);
  } catch (err) {
    if (session.inTransaction && session.inTransaction()) {
      await session.abortTransaction();
    }
    res.status(500).json({ message: 'Server error creating order', error: err.message });
  }
};

// @route  POST /api/orders/:id/verify-payment
// Body: { reference } — confirms a paystack-method order's payment.
// Amount/status come ONLY from Paystack, never the client — same
// idempotency pattern as wallet top-up verification.
const verifyOrderPayment = async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ message: 'Reference is required' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to verify this order' });
    }
    if (order.paymentMethod !== 'paystack') {
      return res.status(400).json({ message: 'This order is not a Paystack payment' });
    }

    // Already verified? Return as-is — idempotent, no double-processing.
    if (order.paymentStatus === 'paid') {
      return res.status(200).json(order);
    }

    // Duplicate-reference guard — a reference can only ever confirm one order
    const referenceInUse = await Order.findOne({ paystackReference: reference });
    if (referenceInUse && referenceInUse._id.toString() !== order._id.toString()) {
      return res.status(400).json({ message: 'This payment reference has already been used' });
    }

    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const data = verifyRes.data?.data;
    if (!data || data.status !== 'success') {
      order.paymentStatus = 'failed';
      await order.save();
      return res.status(400).json({ message: 'Payment not successful' });
    }

    const amountNaira = data.amount / 100;
    if (Math.round(amountNaira * 100) !== Math.round(order.totalAmount * 100)) {
      return res.status(400).json({ message: 'Paid amount does not match order total' });
    }

    order.paymentStatus = 'paid';
    order.paystackReference = reference;
    await order.save();

    res.status(200).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error verifying payment', error: err.message });
  }
};

// @route  GET /api/orders
// Staff/admin — all orders. Customers — only their own.
const getOrders = async (req, res) => {
  try {
    const filter = req.user.role === 'customer' ? { customer: req.user._id } : {};

    const orders = await Order.find(filter)
      .populate('items.menuItem', 'name price category image')
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching orders', error: err.message });
  }
};

// @route  GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.menuItem', 'name price category image')
      .populate('customer', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role === 'customer' && order.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.status(200).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching order', error: err.message });
  }
};

// @route  PATCH /api/orders/:id/status
// Staff/admin only — update order status. Stamps the matching timestamp
// field so the customer can see when each stage happened (order tracking).
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    if (status === 'preparing' && !order.preparingAt) order.preparingAt = new Date();
    if (status === 'ready' && !order.readyAt) order.readyAt = new Date();
    if (status === 'completed' && !order.completedAt) order.completedAt = new Date();
    if (status === 'cancelled' && !order.cancelledAt) order.cancelledAt = new Date();

    const updated = await order.save();

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating order status', error: err.message });
  }
};

module.exports = { createOrder, verifyOrderPayment, getOrders, getOrderById, updateOrderStatus };