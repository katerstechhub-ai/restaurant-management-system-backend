const Table = require('../models/Table');
const Reservation = require('../models/Reservation');

// How long each reservation slot occupies a table. Matches the frontend's
// TIME_SLOTS, which are spaced 1 hour apart.
const SLOT_DURATION_MS = 60 * 60 * 1000;

// @route  GET /api/tables
// Returns every table with a LIVE status overlay: a table stored as
// 'available' shows 'reserved' here if a confirmed reservation for today
// falls inside its time-slot window right now. This never writes to
// Table.status — walk-in/release/out-of-service still fully own that field
// — it's purely a read-time computation so the floor plan actually reflects
// reservations customers have made, instead of staying 'available' forever.
exports.getAllTables = async (req, res) => {
  try {
    const tables = await Table.find().sort({ tableNumber: 1 });

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const todaysReservations = await Reservation.find({
      date: { $gte: todayStart, $lte: todayEnd },
      status: 'confirmed',
    });

    const reservedTableIds = new Set();
    for (const r of todaysReservations) {
      const [hh, mm] = r.timeSlot.split(':').map(Number);
      const slotStart = new Date(r.date);
      slotStart.setHours(hh, mm || 0, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MS);
      if (now >= slotStart && now < slotEnd) {
        reservedTableIds.add(r.table.toString());
      }
    }

    const result = tables.map((t) => {
      const table = t.toObject();
      if (table.status === 'available' && reservedTableIds.has(t._id.toString())) {
        table.status = 'reserved';
      }
      return table;
    });

    res.json(result);
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
// Body: { tableId, status } — status must be 'available', 'occupied', or
// 'unavailable' (out of service). Admin-only manual override, e.g. taking
// a broken table out of service or putting it back once fixed.
exports.updateTableStatus = async (req, res) => {
  try {
    const { tableId, status } = req.body;
    const validStatuses = ['available', 'occupied', 'unavailable'];

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