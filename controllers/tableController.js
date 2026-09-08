const Table = require('../models/Table');
const Reservation = require('../models/Reservation');

// How long a reservation holds a table on the live floor plan, and how far
// ahead of the slot it starts showing as "reserved". Both computed on read
// only — never written to the database — so a table clears itself the
// moment the window passes, with no cron job needed, and a booking for a
// future date never blocks today's walk-ins.
const SLOT_DURATION_MINUTES = 60;
const RESERVED_LEAD_MINUTES = 30;

function isSlotActiveNow(reservationDate, timeSlot) {
  const [hours, minutes] = timeSlot.split(':').map(Number);
  const slotStart = new Date(reservationDate);
  slotStart.setHours(hours, minutes, 0, 0);

  const windowStart = new Date(slotStart.getTime() - RESERVED_LEAD_MINUTES * 60000);
  const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60000);

  const now = new Date();
  return now >= windowStart && now <= slotEnd;
}

// Table IDs that have a confirmed reservation whose window covers this exact
// moment. Only today's reservations are even worth checking — anything
// earlier or later can't have an active window right now.
async function getActivelyReservedTableIds() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todaysReservations = await Reservation.find({
    status: 'confirmed',
    date: { $gte: startOfDay, $lte: endOfDay },
  });

  const activeIds = new Set();
  for (const r of todaysReservations) {
    if (isSlotActiveNow(r.date, r.timeSlot)) {
      activeIds.add(r.table.toString());
    }
  }
  return activeIds;
}

exports.getAllTables = async (req, res) => {
  try {
    const tables = await Table.find().sort({ tableNumber: 1 });
    const activelyReservedIds = await getActivelyReservedTableIds();

    // Overlay the computed "reserved" state on top of whatever's actually
    // stored. Live floor state always wins: a table someone is physically
    // sitting at ('occupied') or one that's out of service ('unavailable')
    // isn't overridden by a reservation window.
    const annotated = tables.map((t) => {
      const table = t.toObject();
      if (table.status === 'available' && activelyReservedIds.has(t._id.toString())) {
        table.status = 'reserved';
      }
      return table;
    });

    res.json(annotated);
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