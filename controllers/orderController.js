const mongoose = require('mongoose');
const axios = require('axios');
const Order = require('../models/Order');
const Menu = require('../models/Menu');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');

// Shared by createOrder and payOrderWithCard — validates the cart against
// the menu and computes the price server-side (never trust client-sent
// prices). Throws a { status, message } style error object on failure so
// both callers can respond consistently.
async function resolveOrderItems(items) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw { status: 400, message: 'Order must include at least one item' };
  }

  let totalAmount = 0;
  const resolvedItems = [];

  for (const entry of items) {
    const menuItem = await Menu.findById(entry.menuItem);
    if (!menuItem) {
      throw { status: 404, message: `Menu item not found: ${entry.menuItem}` };
    }
    if (!menuItem.available) {
      throw { status: 400, message: `Menu item unavailable: ${menuItem.name}` };
    }

    const quantity = entry.quantity || 1;
    totalAmount += menuItem.price * quantity;

    resolvedItems.push({
      menuItem: menuItem._id,
      quantity,
      customizations: entry.customizations || '',
    });
  }

  return { resolvedItems, totalAmount };
}

// Resolves the delivery address to use for an order: whatever was typed at
// checkout, falling back to the address already on the user's profile.
// Throws if the order is a delivery order and neither exists.
function resolveDeliveryAddress(resolvedOrderType, suppliedAddress, userAddress) {
  if (resolvedOrderType !== 'delivery') return undefined;
  const address = (suppliedAddress && suppliedAddress.trim()) || userAddress;
  if (!address) {
    throw { status: 400, message: 'Delivery address is required' };
  }
  return address;
}

// @route  POST /api/orders
// Authenticated users (customer/staff) can place an order.
// Delivery orders MUST be paid from the wallet. Dine-in orders can
// optionally be paid from the wallet via `payWithWallet: true` in the body.
const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { items, orderType, table, payWithWallet, deliveryAddress } = req.body;
    const resolvedOrderType = orderType || 'dine-in';

    let resolvedItems, totalAmount, address;
    try {
      ({ resolvedItems, totalAmount } = await resolveOrderItems(items));
      address = resolveDeliveryAddress(resolvedOrderType, deliveryAddress, req.user.address);
    } catch (validationErr) {
      return res.status(validationErr.status || 400).json({ message: validationErr.message });
    }

    // Delivery is always wallet-paid. Dine-in is wallet-paid only if the client asked for it.
    const requiresWalletPayment =
      resolvedOrderType === 'delivery' || (resolvedOrderType === 'dine-in' && payWithWallet === true);

    let order;
    let insufficientBalance = null;

    session.startTransaction();
    try {
      if (requiresWalletPayment) {
        const user = await User.findById(req.user._id).session(session);

        if (user.walletBalance < totalAmount) {
          await session.abortTransaction();
          insufficientBalance = {
            balance: user.walletBalance,
            required: totalAmount,
            shortfall: Number((totalAmount - user.walletBalance).toFixed(2)),
          };
        } else {
          user.walletBalance -= totalAmount;
          await user.save({ session });

          const createdOrders = await Order.create(
            [{
              customer: req.user._id,
              items: resolvedItems,
              orderType: resolvedOrderType,
              table: table || undefined,
              totalAmount,
              paidWithWallet: true,
              deliveryAddress: address,
            }],
            { session }
          );
          order = createdOrders[0];

          await WalletTransaction.create(
            [{
              user: user._id,
              type: 'deduction',
              amount: totalAmount,
              balanceAfter: user.walletBalance,
              method: 'wallet',
              description: `Payment for order #${order._id.toString().slice(-6)}`,
            }],
            { session }
          );
        }
      } else {
        const createdOrders = await Order.create(
          [{
            customer: req.user._id,
            items: resolvedItems,
            orderType: resolvedOrderType,
            table: table || undefined,
            totalAmount,
            paidWithWallet: false,
            deliveryAddress: address,
          }],
          { session }
        );
        order = createdOrders[0];
      }

      if (order) {
        // Reduce raw-ingredient stock for whatever this order actually consumes.
        // Stock moves at order creation (kitchen starts pulling ingredients
        // immediately), not at payment settlement — dine-in orders that pay
        // later still consume ingredients now.
        await decrementInventoryForItems(resolvedItems, session);
        order.stockDecremented = true;
        await order.save({ session });

        await session.commitTransaction();
      }
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    if (insufficientBalance) {
      return res.status(402).json({ message: 'Insufficient wallet balance', ...insufficientBalance });
    }

    // First time this user has given us a delivery address — save it to
    // their profile so future orders don't ask again.
    if (order && address && !req.user.address) {
      await User.findByIdAndUpdate(req.user._id, { address });
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error creating order', error: err.message });
  }
};

// @route  POST /api/orders/pay
// Card-payment path — mirrors walletController.verifyTopUp: Paystack is the
// only source of truth for amount/status, and the order is only created
// once payment is confirmed, so an unpaid attempt never reaches the kitchen
// queue and never touches inventory. Same Paystack keys as wallet top-ups,
// so funds settle straight to the restaurant's connected Paystack account —
// there's no separate "enter the owner's account number" step needed.
const payOrderWithCard = async (req, res) => {
  try {
    const { reference, items, orderType, table, deliveryAddress } = req.body;
    if (!reference) {
      return res.status(400).json({ message: 'Reference is required' });
    }

    // Idempotency check #1 — already processed? (user refreshed after
    // paying, or the callback fired twice)
    const existing = await Order.findOne({ paystackReference: reference });
    if (existing) {
      return res.status(200).json(existing);
    }

    const resolvedOrderType = orderType || 'dine-in';

    let resolvedItems, totalAmount, address;
    try {
      ({ resolvedItems, totalAmount } = await resolveOrderItems(items));
      address = resolveDeliveryAddress(resolvedOrderType, deliveryAddress, req.user.address);
    } catch (validationErr) {
      return res.status(validationErr.status || 400).json({ message: validationErr.message });
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

    if (String(data.metadata?.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Reference does not belong to this user' });
    }

    // Guard against a stale cart total / tampering — what was actually
    // charged must match what this cart actually costs.
    if (data.amount !== Math.round(totalAmount * 100)) {
      return res.status(400).json({ message: 'Payment amount does not match order total' });
    }

    let order;
    try {
      order = await Order.create({
        customer: req.user._id,
        items: resolvedItems,
        orderType: resolvedOrderType,
        table: table || undefined,
        totalAmount,
        paidWithCard: true,
        paystackReference: reference,
        deliveryAddress: address,
      });
    } catch (dupErr) {
      // Idempotency check #2 — race condition caught by the unique index on `reference`
      if (dupErr.code === 11000) {
        const raced = await Order.findOne({ paystackReference: reference });
        return res.status(200).json(raced);
      }
      throw dupErr;
    }

    if (address && !req.user.address) {
      await User.findByIdAndUpdate(req.user._id, { address });
    }

    await decrementInventoryForItems(resolvedItems);
    order.stockDecremented = true;
    await order.save();

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error processing card payment', error: err.message });
  }
};

// Decrements Inventory stock for a set of resolved order line items, based on
// each Menu item's configured `ingredients` recipe. Menu items with no
// ingredients configured are skipped — inventory tracking is opt-in per dish,
// not required for every menu item. Stock is clamped at 0 rather than going
// negative or blocking the order (mirrors inventoryController.updateStock).
// `session` is optional — payOrderWithCard calls this outside a transaction.
async function decrementInventoryForItems(resolvedItems, session = null) {
  const Inventory = require('../models/Inventory');

  for (const line of resolvedItems) {
    const menuItem = await Menu.findById(line.menuItem).session(session);
    if (!menuItem || !Array.isArray(menuItem.ingredients) || menuItem.ingredients.length === 0) {
      continue; // this dish has no ingredient recipe configured — nothing to decrement
    }
    for (const ing of menuItem.ingredients) {
      const needed = ing.quantityUsed * line.quantity;
      const invItem = await Inventory.findById(ing.inventoryItem).session(session);
      if (!invItem) continue; // configured ingredient was deleted from inventory — skip rather than fail the order
      invItem.quantity = Math.max(0, invItem.quantity - needed);
      await invItem.save({ session });
    }
  }
}

// Restores Inventory stock for a cancelled order's line items (compensating
// action for decrementInventoryForItems above). Not run in a transaction —
// it's a best-effort correction, safe to be a no-op for ingredients that no
// longer exist.
async function restoreInventoryForItems(items) {
  const Inventory = require('../models/Inventory');

  for (const line of items) {
    const menuItem = await Menu.findById(line.menuItem);
    if (!menuItem || !Array.isArray(menuItem.ingredients)) continue;
    for (const ing of menuItem.ingredients) {
      const needed = ing.quantityUsed * line.quantity;
      await Inventory.findByIdAndUpdate(ing.inventoryItem, { $inc: { quantity: needed } });
    }
  }
}

// @route  GET /api/orders
// Staff/admin — all orders. Customers — only their own.
const getOrders = async (req, res) => {
  try {
    const filter = req.user.role === 'customer' ? { customer: req.user._id } : {};

    const orders = await Order.find(filter)
      .populate('items.menuItem', 'name price category image')
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching orders', error: err.message });
  }
};

// @route  GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.menuItem', 'name price category image')
      .populate('customer', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role === 'customer' && order.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.status(200).json(order);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching order', error: err.message });
  }
};

// @route  PATCH /api/orders/:id/status
// Staff/admin only — update order status (pending -> in-progress -> completed)
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const wasAlreadyCancelled = order.status === 'cancelled';
    order.status = status;

    // Cancelling an order that already had stock deducted puts those
    // ingredients back — but only once, and only if we actually took them.
    if (status === 'cancelled' && !wasAlreadyCancelled && order.stockDecremented) {
      await restoreInventoryForItems(order.items);
      order.stockDecremented = false;
    }

    const updated = await order.save();

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server error updating order status', error: err.message });
  }
};

module.exports = { createOrder, payOrderWithCard, getOrders, getOrderById, updateOrderStatus };