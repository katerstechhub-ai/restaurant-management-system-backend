// One-off script: creates a Customer profile for any existing 'customer'
// role User that doesn't already have one (e.g. accounts registered
// before the register controller was fixed to create Customer docs).
//
// Run once from your backend project root:
//   node scripts/backfillCustomers.js
//
// Safe to re-run -- it skips users that already have a Customer.

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Customer = require('../models/Customer');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const customerRoleUsers = await User.find({ role: 'customer' });
  console.log(`Found ${customerRoleUsers.length} users with role 'customer'`);

  let created = 0;
  for (const user of customerRoleUsers) {
    const exists = await Customer.findOne({ user: user._id });
    if (!exists) {
      await Customer.create({ user: user._id });
      created++;
      console.log(`Created Customer for ${user.email}`);
    }
  }

  console.log(`Done. Created ${created} missing Customer record(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});