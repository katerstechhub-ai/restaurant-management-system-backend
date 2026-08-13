const Order = require('../models/Order');
const Menu = require('../models/Menu');

// @route  POST /api/orders
// Authenticated users (customer/staff) can place an order
const createOrder = async (req, res) => {
  try {
    const { items, orderType, table } = req.body;

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

    const order = await Order.create({
      customer: req.user._id,
      items: resolvedItems,
      orderType: orderType || 'dine-in',
      table: table || undefined,
      totalAmount,
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error creating order', error: err.message });
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

    // Customers can only view their own orders
    if (req.user.role === 'customer' && order.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.status(200).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching order', error: err.message });
  }
};

// @route  PATCH /api/orders/:id/status
// Staff/admin only — update order status (pending -> in-progress -> completed)
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'in-progress', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.status = status;
    const updated = await order.save();

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating order status', error: err.message });
  }
};

module.exports = { createOrder, getOrders, getOrderById, updateOrderStatus };