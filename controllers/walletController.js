const axios = require('axios');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

// @route  GET /api/wallet
// Returns the logged-in user's current wallet balance
const getWallet = async (req, res) => {
  try {
    res.status(200).json({ balance: req.user.walletBalance });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching wallet', error: err.message });
  }
};

// @route  GET /api/wallet/transactions
// Wallet ledger for the logged-in user (top-ups and deductions)
const getWalletTransactions = async (req, res) => {
  try {
    const transactions = await WalletTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    res.status(200).json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching wallet transactions', error: err.message });
  }
};

// @route  POST /api/wallet/init
// Body: { amount } — creates a Paystack transaction and returns the reference/access_code
const initTopUp = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    const initRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: req.user.email,
        amount: Math.round(Number(amount) * 100), // kobo
        metadata: { userId: req.user._id.toString() },
      },
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    res.status(200).json(initRes.data.data); // { authorization_url, access_code, reference }
  } catch (err) {
    res.status(500).json({ message: 'Server error initializing payment', error: err.message });
  }
};

// @route  POST /api/wallet/verify
// Body: { reference } — amount and success/failure come ONLY from Paystack, never the client
const verifyTopUp = async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ message: 'Reference is required' });
    }

    // Idempotency check #1 — already processed?
    const existing = await WalletTransaction.findOne({ reference });
    if (existing) {
      return res.status(200).json({ balance: existing.balanceAfter, transaction: existing });
    }

    // Verify with Paystack — the only source of truth for amount/status
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const data = verifyRes.data?.data;
    if (!data || data.status !== 'success') {
      return res.status(400).json({ message: 'Payment not successful' });
    }

    const amountNaira = data.amount / 100; // Paystack amounts are in kobo

    // Reference must belong to this user (set at init time via metadata)
    if (String(data.metadata?.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Reference does not belong to this user' });
    }

    const user = await User.findById(req.user._id);
    user.walletBalance += amountNaira;
    await user.save();

    let transaction;
    try {
      transaction = await WalletTransaction.create({
        user: user._id,
        type: 'topup',
        amount: amountNaira,
        balanceAfter: user.walletBalance,
        method: data.channel || 'card',
        description: 'Wallet top-up via Paystack',
        reference,
      });
    } catch (dupErr) {
      // Idempotency check #2 — race condition caught by the unique index on `reference`
      if (dupErr.code === 11000) {
        user.walletBalance -= amountNaira; // roll back the credit we just gave
        await user.save();
        const raced = await WalletTransaction.findOne({ reference });
        return res.status(200).json({ balance: raced.balanceAfter, transaction: raced });
      }
      throw dupErr;
    }

    res.status(201).json({ balance: user.walletBalance, transaction });
  } catch (err) {
    res.status(500).json({ message: 'Server error verifying top-up', error: err.message });
  }
};

module.exports = { getWallet, getWalletTransactions, initTopUp, verifyTopUp };