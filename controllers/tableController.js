const Table = require('../models/Table');

exports.getAllTables = async (req, res) => {
  try {
    const tables = await Table.find().sort({ tableNumber: 1 });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addTable = async (req, res) => {
  try {
    const { tableNumber, capacity } = req.body;
    const newTable = new Table({ tableNumber, capacity });
    await newTable.save();
    res.status(201).json(newTable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.assignTableWalkIn = async (req, res) => {
  try {
    const { tableId } = req.body;
    const table = await Table.findById(tableId);
    if (!table) return res.status(404).json({ message: 'Table not found' });
    if (table.status !== 'available') return res.status(400).json({ message: 'Table is not available' });

    table.status = 'occupied';
    await table.save();
    res.json({ message: 'Table assigned successfully', table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.autoAssignTable = async (req, res) => {
  try {
    const { partySize } = req.body;
    // Find smallest available table that fits the party size
    const table = await Table.findOne({
      status: 'available',
      capacity: { $gte: partySize }
    }).sort({ capacity: 1 });

    if (!table) return res.status(404).json({ message: 'No suitable tables available' });

    table.status = 'occupied';
    await table.save();
    res.json({ message: 'Table auto-assigned successfully', table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.releaseTable = async (req, res) => {
  try {
    const { tableId } = req.body;
    const table = await Table.findById(tableId);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    table.status = 'available';
    await table.save();
    res.json({ message: 'Table released successfully', table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};