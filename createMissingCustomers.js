require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Customer = require('./models/Customer');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const users = await User.find({ role: 'customer' });
  for (const u of users) {
    const exists = await Customer.findOne({ user: u._id });
    if (!exists) {
      await Customer.create({ user: u._id });
      console.log('Created Customer for', u.email);
    } else {
      console.log('Already exists for', u.email);
    }
  }
  process.exit(0);
});