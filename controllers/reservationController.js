const axios = require('axios');
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Table = require('../models/Table');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const BANK_DETAILS = require('../config/bankDetails');

// Flat fee to hold a table. Change this one line to adjust the price —
// used to be no charge at all for booking a reservation.
const RESERVATION_FEE = 2000;

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

    res.json({ date, timeSlot, tables: seatMap, fee: RESERVATION_FEE });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/reservations/mine?includeCancelled=true
// By default, cancelled reservations are excluded — matches the
// show/hide pattern already used for completed orders and resolved
// tickets elsewhere in the app. Pass ?includeCancelled=true to see them.
exports.getMyReservations = async (req, res) => {
  try {
    const customerId = req.user.id;
    const includeCancelled = req.query.includeCancelled === 'true';

    const filter = { customer: customerId };
    if (!includeCancelled) {
      filter.status = { $ne: 'cancelled' };
    }

    const reservations = await Reservation.find(filter)
      .populate('table')
      .sort({ date: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/reservations?date=YYYY-MM-DD&includeCancelled=true
// Admin/waiter/kitchen — every customer's reservations, optionally
// filtered to one date. Cancelled reservations are excluded by default,
// same convention as getMyReservations — a cancelled booking has nothing
// left for staff to act on, so it shouldn't clutter the working list.
exports.getAllReservations = async (req, res) => {
  try {
    const { date } = req.query;
    const includeCancelled = req.query.includeCancelled === 'true';
    const filter = {};

    if (!includeCancelled) {
      filter.status = { $ne: 'cancelled' };
    }

    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date' });
      }
      const start = new Date(parsedDate); start.setHours(0, 0, 0, 0);
      const end = new Date(parsedDate); end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    const reservations = await Reservation.find(filter)
      .populate('customer', 'name email')
      .populate('table', 'tableNumber capacity')
      .sort({ date: -1, timeSlot: 1 });

    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  POST /api/reservations
// paymentMethod: 'wallet' | 'paystack' | 'bank_transfer' — same 3 options
// and same behavior pattern as order payment: wallet deducts immediately,
// paystack/bank_transfer create the reservation as payment-pending and the
// customer finishes payment right after (popup) or is shown bank details.
exports.createReservation = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { tableId, date, timeSlot, paymentMethod } = req.body;
    const customerId = req.user.id;
    const resolvedPaymentMethod = ['wallet', 'paystack', 'bank_transfer'].includes(paymentMethod)
      ? paymentMethod
      : 'wallet';

    const table = await Table.findById(tableId);
    if (!table) return res.status(404).json({ message: 'Table not found' });

    // A table out of service can never be booked, no matter the date/slot —
    // mirrors the check in getTableAvailability so the seat map and the
    // actual booking can never disagree.
    if (table.status === 'unavailable') {
      return res.status(400).json({ message: 'This table is currently out of service' });
    }

    let reservation;

    if (resolvedPaymentMethod === 'wallet') {
      session.startTransaction();
      try {
        const user = await User.findById(customerId).session(session);

        if (user.walletBalance < RESERVATION_FEE) {
          await session.abortTransaction();
          return res.status(402).json({
            message: 'Insufficient wallet balance',
            balance: user.walletBalance,
            required: RESERVATION_FEE,
            shortfall: Number((RESERVATION_FEE - user.walletBalance).toFixed(2)),
          });
        }

        user.walletBalance -= RESERVATION_FEE;
        await user.save({ session });

        const created = await Reservation.create(
          [{
            customer: customerId,
            table: tableId,
            date: new Date(date),
            timeSlot,
            amount: RESERVATION_FEE,
            paymentMethod: 'wallet',
            paymentStatus: 'paid',
          }],
          { session }
        );
        reservation = created[0];

        await WalletTransaction.create(
          [{
            user: user._id,
            type: 'deduction',
            amount: RESERVATION_FEE,
            balanceAfter: user.walletBalance,
            method: 'wallet',
            description: `Reservation fee for table ${table.tableNumber}`,
          }],
          { session }
        );

        await session.commitTransaction();
      } catch (txErr) {
        await session.abortTransaction();
        throw txErr;
      } finally {
        session.endSession();
      }
    } else {
      session.endSession(); // not used on this path
      reservation = await Reservation.create({
        customer: customerId,
        table: tableId,
        date: new Date(date),
        timeSlot,
        amount: RESERVATION_FEE,
        paymentMethod: resolvedPaymentMethod,
        paymentStatus: 'pending',
      });
    }

    const response = reservation.toObject();
    if (resolvedPaymentMethod === 'bank_transfer') {
      response.bankDetails = BANK_DETAILS;
    }

    res.status(201).json(response);
  } catch (error) {
    if (session.inTransaction && session.inTransaction()) {
      await session.abortTransaction();
    }
    // Duplicate-key error from the unique index means the slot is already taken
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Table is already reserved for this slot' });
    }
    res.status(500).json({ error: error.message });
  }
};

// @route  POST /api/reservations/:id/verify-payment
// Body: { reference } — confirms a paystack-method reservation's payment.
// Same idempotency pattern as order payment verification.
exports.verifyReservationPayment = async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ message: 'Reference is required' });
    }

    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    if (reservation.customer.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not authorized to verify this reservation' });
    }
    if (reservation.paymentMethod !== 'paystack') {
      return res.status(400).json({ message: 'This reservation is not a Paystack payment' });
    }
    if (reservation.paymentStatus === 'paid') {
      return res.status(200).json(reservation);
    }

    const referenceInUse = await Reservation.findOne({ paystackReference: reference });
    if (referenceInUse && referenceInUse._id.toString() !== reservation._id.toString()) {
      return res.status(400).json({ message: 'This payment reference has already been used' });
    }

    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const data = verifyRes.data?.data;
    if (!data || data.status !== 'success') {
      reservation.paymentStatus = 'failed';
      await reservation.save();
      return res.status(400).json({ message: 'Payment not successful' });
    }

    const amountNaira = data.amount / 100;
    if (Math.round(amountNaira * 100) !== Math.round(reservation.amount * 100)) {
      return res.status(400).json({ message: 'Paid amount does not match reservation fee' });
    }

    reservation.paymentStatus = 'paid';
    reservation.paystackReference = reference;
    await reservation.save();

    res.status(200).json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  PATCH /api/reservations/:id/confirm-payment
// Admin/waiter only — marks a bank_transfer reservation as paid once staff
// has actually seen the money land. This is the "customer is informed once
// the restaurant has received it" step for bank transfers (paystack and
// wallet already confirm automatically).
exports.confirmReservationPayment = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    if (reservation.paymentMethod !== 'bank_transfer') {
      return res.status(400).json({ message: 'Only bank transfer payments need manual confirmation' });
    }

    reservation.paymentStatus = 'paid';
    await reservation.save();

    res.status(200).json(reservation);
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

    // No table.status to release here — reservations never mutate it (see
    // createReservation). Live floor state is owned entirely by
    // tableController (walk-in/auto-assign/release/out-of-service), and
    // getAllTables already excludes cancelled reservations from its
    // "reserved" overlay computation, so this table stops showing reserved
    // the very next time the floor plan is fetched.

    res.json({ message: 'Reservation cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};