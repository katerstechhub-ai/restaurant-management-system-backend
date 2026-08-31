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

    // Release the associated table so it can be booked again
    await Table.findByIdAndUpdate(reservation.table, { status: 'available' });

    res.json({ message: 'Reservation cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};