const Order = require('../models/Order');

exports.getSalesTrends = async (req, res) => {
  try {
    const trends = await Order.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTopDishes = async (req, res) => {
  try {
    const topDishes = await Order.aggregate([
      { $match: { status: 'completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.menuItem',
          totalOrdered: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalOrdered: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'menus',
          localField: '_id',
          foreignField: '_id',
          as: 'menuItem',
        },
      },
      { $unwind: '$menuItem' },
      {
        $project: {
          _id: 0,
          name: '$menuItem.name',
          totalOrdered: 1,
        },
      },
    ]);
    res.json(topDishes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Report generation — CSV export (no extra dependency needed for capstone scope).
// type: 'sales' | 'top-dishes'. from/to are optional ISO date strings.
exports.generateReport = async (req, res) => {
  try {
    const { type, from, to } = req.body;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    let rows = [];
    let header = '';

    if (type === 'sales') {
      const match = { status: 'completed' };
      if (from || to) match.createdAt = dateFilter;

      const orders = await Order.find(match).sort({ createdAt: 1 });
      header = 'date,orderId,totalAmount\n';
      rows = orders.map(o => `${o.createdAt.toISOString()},${o._id},${o.totalAmount || 0}`);
    } else if (type === 'top-dishes') {
      const pipeline = [
        { $match: { status: 'completed' } },
        { $unwind: '$items' },
        { $group: { _id: '$items.menuItem', totalOrdered: { $sum: '$items.quantity' } } },
        { $sort: { totalOrdered: -1 } },
        { $lookup: { from: 'menus', localField: '_id', foreignField: '_id', as: 'menuItem' } },
        { $unwind: '$menuItem' },
        { $project: { _id: 0, name: '$menuItem.name', totalOrdered: 1 } },
      ];
      const dishes = await Order.aggregate(pipeline);
      header = 'dish,totalOrdered\n';
      rows = dishes.map(d => `${d.name},${d.totalOrdered}`);
    } else {
      return res.status(400).json({ message: 'Unknown report type' });
    }

    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}-report.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};