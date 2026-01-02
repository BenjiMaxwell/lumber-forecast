const express = require('express');
const router = express.Router();
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  updateStatus,
  deleteOrder,
  getLeadTimes,
  getOrdersForItem,
  getPendingSummary
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.get('/lead-times', getLeadTimes);
router.get('/pending-summary', getPendingSummary);
router.get('/item/:itemId', getOrdersForItem);

router.route('/:id')
  .get(getOrder)
  .put(updateOrder)
  .delete(authorize('admin'), deleteOrder);

router.put('/:id/status', updateStatus);

module.exports = router;
