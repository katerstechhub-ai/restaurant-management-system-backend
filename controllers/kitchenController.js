const Order = require('../models/Order');

exports.getKitchenQueue = async (req, res) => {
  try {
    // Fetch pending and preparing orders
    const queue = await Order.find({
      status: { $in: ['pending', 'preparing'] }
    }).populate('customer', 'name email')
      .populate('items.menuItem')
      .sort({ createdAt: 1 }); // oldest first
      
    res.json(queue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'preparing', 'ready', 'completed'

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    await order.save();

    res.json({ message: 'Order status updated', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};