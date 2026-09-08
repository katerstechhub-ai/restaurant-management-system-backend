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
    const { tableNumber, capacity, x, y, shape } = req.body;
    const newTable = new Table({ tableNumber, capacity, x, y, shape });
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

// @route  PATCH /api/tables/status
// Admin only — take a table out of service ('unavailable') or bring it back
// ('available'). This is distinct from occupied/released, which reflect
// live floor state; 'unavailable' means the table can't be booked or seated
// at all (broken furniture, closed section, etc.) regardless of date/time.
exports.updateTableStatus = async (req, res) => {
  try {
    const { tableId, status } = req.body;
    const validStatuses = ['available', 'unavailable'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const table = await Table.findById(tableId);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    table.status = status;
    await table.save();
    res.json({ message: 'Table status updated', table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};