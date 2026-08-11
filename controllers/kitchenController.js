const Order = require('../models/Order');

exports.getKitchenQueue = async (req, res) => {
  try {
    // Fetch pending and in-progress orders
    const queue = await Order.find({
      status: { $in: ['pending', 'in-progress'] }
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
    const { status } = req.body; // 'in-progress', 'completed'

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.status = status;
    await order.save();

    res.json({ message: 'Order status updated', order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
