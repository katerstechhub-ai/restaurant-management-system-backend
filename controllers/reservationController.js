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

exports.createReservation = async (req, res) => {
  try {
    const { tableId, date, timeSlot } = req.body;
    const customerId = req.user.id; // from auth middleware

    const table = await Table.findById(tableId);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    // Check if already reserved
    const existing = await Reservation.findOne({
      table: tableId,
      date: new Date(date),
      timeSlot,
      status: 'confirmed'
    });
    if (existing) return res.status(400).json({ message: 'Table is already reserved for this slot' });

    const reservation = new Reservation({
      customer: customerId,
      table: tableId,
      date: new Date(date),
      timeSlot
    });
    await reservation.save();
    res.status(201).json(reservation);
  } catch (error) {
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
    res.json({ message: 'Reservation cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
