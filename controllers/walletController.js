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

// @route  POST /api/wallet/topup
// Adds funds to the logged-in user's wallet
const topUpWallet = async (req, res) => {
    try {
        const { amount, method } = req.body;
        const validMethods = ['card', 'mobile', 'cash'];

        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ message: 'Amount must be greater than 0' });
        }

        if (method && !validMethods.includes(method)) {
            return res.status(400).json({ message: `Method must be one of: ${validMethods.join(', ')}` });
        }

        const user = await User.findById(req.user._id);
        user.walletBalance += Number(amount);
        await user.save();

        const transaction = await WalletTransaction.create({
            user: user._id,
            type: 'topup',
            amount: Number(amount),
            balanceAfter: user.walletBalance,
            method: method || 'card',
            description: 'Wallet top-up',
        });

        res.status(201).json({ balance: user.walletBalance, transaction });
    } catch (err) {
        res.status(500).json({ message: 'Server error topping up wallet', error: err.message });
    }
};

module.exports = { getWallet, getWalletTransactions, topUpWallet };