const express = require('express');
const router = express.Router();
const {
  getWallet,
  getWalletTransactions,
  initTopUp,
  verifyTopUp,
} = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getWallet);
router.get('/transactions', protect, getWalletTransactions);
router.post('/init', protect, initTopUp);
router.post('/verify', protect, verifyTopUp);

module.exports = router;