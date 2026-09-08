const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Customer = require('../models/Customer');

const ALLOWED_ROLES = ['admin', 'waiter', 'kitchen', 'customer'];

// @route  POST /api/users
// Admin-only. This is the only way a waiter/kitchen/admin account gets
// created — the public /api/auth/register endpoint always forces
// role: 'customer' and can't be used to create staff accounts.
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: `Role must be one of: ${ALLOWED_ROLES.join(', ')}` });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with that email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, password: hashedPassword, role });

    if (user.role === 'customer') {
      await Customer.create({ user: user._id });
    }

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  GET /api/users
// Admin-only. Lists every account so admin can see who has what role.
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -resetPasswordToken -resetPasswordExpires').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @route  PUT /api/users/:id/role
// Admin-only. Lets admin fix a mis-assigned role without deleting/recreating the account.
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ message: `Role must be one of: ${ALLOWED_ROLES.join(', ')}` });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const wasCustomer = user.role === 'customer';
    user.role = role;
    await user.save();

    // Keep the Customer profile in sync if someone's role changes to/from customer.
    if (!wasCustomer && role === 'customer') {
      const existingProfile = await Customer.findOne({ user: user._id });
      if (!existingProfile) await Customer.create({ user: user._id });
    }

    res.json({ _id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};