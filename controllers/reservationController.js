const Reservation = require('../models/Reservation');
const Table = require('../models/Table');

exports.getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.query; // expecting YYYY-MM-DD
    if (!date) return res.status(400).json({ message: 'Date is required' });

    // Simple implementation: fetch all reservations for the date
    const reservations = await Reservation.find({
      date: new Date(date),
      status: 'confirmed'
    }).populate('table');

    // Return the booked slots so frontend knows what is NOT available
    res.json({ booked: reservations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/reservations/availability?date=YYYY-MM-DD&timeSlot=...
// The "seat map" endpoint — every table, annotated with whether it can be
// picked for this specific date + timeSlot. No auth required, same as
// getAvailableSlots above, so customers can browse before logging in
// (like checking flight seats before you've entered payment details).
//
// A table shows 'unavailable' if it's out of service (Table.status), or
// 'booked' if it already has a confirmed reservation for this exact
// date+timeSlot. A table that's currently 'occupied' on the live floor
// (someone dining right now) does NOT block a future reservation slot —
// that's what the Reservation record itself is for.
exports.getTableAvailability = async (req, res) => {
  try {
    const { date, timeSlot } = req.query;
    if (!date || !timeSlot) {
      return res.status(400).json({ message: 'date and timeSlot are required' });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date' });
    }

    const tables = await Table.find().sort({ tableNumber: 1 });

    const reservations = await Reservation.find({
      date: parsedDate,
      timeSlot,
      status: 'confirmed',
    });
    const bookedTableIds = new Set(reservations.map((r) => r.table.toString()));

    const seatMap = tables.map((t) => {
      let availability;
      if (t.status === 'unavailable') {
        availability = 'unavailable';
      } else if (bookedTableIds.has(t._id.toString())) {
        availability = 'booked';
      } else {
        availability = 'available';
      }

      return {
        _id: t._id,
        tableNumber: t.tableNumber,
        capacity: t.capacity,
        x: t.x,
        y: t.y,
        shape: t.shape,
        availability,
      };
    });

    res.json({ date, timeSlot, tables: seatMap });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMyReservations = async (req, res) => {
  try {
    const customerId = req.user.id;
    const reservations = await Reservation.find({ customer: customerId })
      .populate('table')
      .sort({ date: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createReservation = async (req, res) => {
  try {
    const { tableId, date, timeSlot } = req.body;
    const customerId = req.user.id; // from auth middleware

    const table = await Table.findById(tableId);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    // A table out of service can never be booked, no matter the date/slot —
    // mirrors the check in getTableAvailability so the seat map and the
    // actual booking can never disagree.
    if (table.status === 'unavailable') {
      return res.status(400).json({ message: 'This table is currently out of service' });
    }

    const reservation = new Reservation({
      customer: customerId,
      table: tableId,
      date: new Date(date),
      timeSlot
    });
    await reservation.save();
    res.status(201).json(reservation);
  } catch (error) {
    // Duplicate-key error from the unique index means the slot is already taken
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Table is already reserved for this slot' });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await Reservation.findById(id);
    if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

    reservation.status = 'cancelled';
    await reservation.save();

    // Release the associated table so it can be booked again — but don't
    // resurrect a table an admin has deliberately marked out of service.
    const table = await Table.findById(reservation.table);
    if (table && table.status !== 'unavailable') {
      table.status = 'available';
      await table.save();
    }

    res.json({ message: 'Reservation cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};