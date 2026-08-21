const Customer = require('../models/Customer');
const Order = require('../models/Order');

exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().populate('user', 'name email');
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.findById(id).populate('user', 'name email');
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const orderHistory = await Order.find({ customer: customer.user }).sort({ createdAt: -1 });
    res.json({ ...customer.toObject(), orderHistory });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { id } = req.params;
    const { preferences } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    customer.preferences = preferences;
    await customer.save();
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, rating } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    customer.feedback.push({ comment, rating });
    await customer.save();
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Simple tiering by order count/value — capstone-scope "segmentation."
exports.getSegments = async (req, res) => {
  try {
    const customers = await Customer.find().populate('user', 'name email');
    const segments = { new: [], regular: [], vip: [] };

    for (const customer of customers) {
      const orders = await Order.find({ customer: customer.user });
      const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      let segment = 'new';
      if (totalSpent > 200) segment = 'vip';
      else if (orders.length > 2) segment = 'regular';

      customer.segment = segment;
      await customer.save();
      segments[segment].push(customer);
    }

    res.json(segments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};