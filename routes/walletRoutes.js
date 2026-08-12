const express = require('express');
const router = express.Router();
const { getWallet, getWalletTransactions, topUpWallet } = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

// All wallet routes require login
router.get('/', protect, getWallet);
router.get('/transactions', protect, getWalletTransactions);
router.post('/topup', protect, topUpWallet);

module.exports = router;