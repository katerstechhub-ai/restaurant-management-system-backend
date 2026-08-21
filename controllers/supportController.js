const SupportTicket = require('../models/SupportTicket');

exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .populate('customer', 'name email')
      .populate('handledBy', 'name')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const ticket = new SupportTicket({ customer: req.user._id, subject, message });
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