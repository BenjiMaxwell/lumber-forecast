const express = require('express');
const router = express.Router();
const {
  getVendors,
  getVendor,
  createVendor,
  updateVendor,
  deleteVendor,
  setPrice,
  compareVendors,
  optimizeOrder,
  getPriceHistory
} = require('../controllers/vendorController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getVendors)
  .post(createVendor);

router.post('/compare', compareVendors);
router.post('/optimize-order', optimizeOrder);
router.get('/price-history/:itemId', getPriceHistory);

router.route('/:id')
  .get(getVendor)
  .put(updateVendor)
  .delete(authorize('admin'), deleteVendor);

router.post('/:id/prices', setPrice);

module.exports = router;
