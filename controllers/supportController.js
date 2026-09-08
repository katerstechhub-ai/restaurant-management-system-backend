const SupportTicket = require('../models/SupportTicket');

exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .populate('handledBy', 'name')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// A customer's own tickets — scoped server-side to req.user._id, so a
// customer can never see or guess their way into someone else's tickets.
exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ customer: req.user._id })
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const { subject, message } = req.body;

    // Customers filing their own ticket can only ever file it as themselves —
    // never trust a free-text customerName from the body for this role, or
    // one customer could submit a complaint that appears to come from
    // someone else. Staff logging a complaint on a walk-in customer's behalf
    // still supply customerName as free text, same as before.
    const isSelfService = req.user.role === 'customer';
    const customerName = isSelfService ? req.user.name : req.body.customerName;

    if (!customerName) {
      return res.status(400).json({ message: 'customerName is required' });
    }

    const ticket = new SupportTicket({
      subject,
      message,
      customerName,
      customer: isSelfService ? req.user._id : undefined,
    });
    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, handledBy } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (status) ticket.status = status;
    if (handledBy) ticket.handledBy = handledBy;
    await ticket.save();

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};