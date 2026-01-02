const { Vendor, InventoryItem } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { vendorOptimizer } = require('../services');

// @desc    Get all vendors
// @route   GET /api/vendors
exports.getVendors = asyncHandler(async (req, res, next) => {
  const { active, search, sortBy = 'name', order = 'asc' } = req.query;
  const query = {};

  if (active !== undefined) query.isActive = active === 'true';
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } }
    ];
  }

  const vendors = await Vendor.find(query).sort({ [sortBy]: order === 'asc' ? 1 : -1 });
  res.status(200).json({ success: true, count: vendors.length, data: vendors });
});

// @desc    Get single vendor
// @route   GET /api/vendors/:id
exports.getVendor = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return next(new AppError('Vendor not found', 404));

  const itemIds = vendor.prices.map(p => p.item);
  const items = await InventoryItem.find({ _id: { $in: itemIds } }).select('name sku');

  const suppliedItems = items.map(item => {
    const price = vendor.getPriceForItem(item._id);
    return {
      item: { id: item._id, name: item.name, sku: item.sku },
      price: price?.price,
      minQuantity: price?.minQuantity
    };
  });

  res.status(200).json({
    success: true,
    data: { ...vendor.toObject({ virtuals: true }), suppliedItems }
  });
});

// @desc    Create vendor
// @route   POST /api/vendors
exports.createVendor = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.create(req.body);
  res.status(201).json({ success: true, data: vendor });
});

// @desc    Update vendor
// @route   PUT /api/vendors/:id
exports.updateVendor = asyncHandler(async (req, res, next) => {
  let vendor = await Vendor.findById(req.params.id);
  if (!vendor) return next(new AppError('Vendor not found', 404));

  vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  res.status(200).json({ success: true, data: vendor });
});

// @desc    Delete vendor (soft)
// @route   DELETE /api/vendors/:id
exports.deleteVendor = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return next(new AppError('Vendor not found', 404));

  vendor.isActive = false;
  await vendor.save();
  res.status(200).json({ success: true, data: {} });
});

// @desc    Set price for item
// @route   POST /api/vendors/:id/prices
exports.setPrice = asyncHandler(async (req, res, next) => {
  const { itemId, price, minQuantity, expirationDate } = req.body;
  
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) return next(new AppError('Vendor not found', 404));

  const item = await InventoryItem.findById(itemId);
  if (!item) return next(new AppError('Item not found', 404));

  vendor.setPrice(itemId, price, minQuantity || 1, expirationDate);
  await vendor.save();

  res.status(200).json({ success: true, data: vendor });
});

// @desc    Compare vendors for an item
// @route   POST /api/vendors/compare
exports.compareVendors = asyncHandler(async (req, res, next) => {
  const { itemId, quantity, preference } = req.body;

  if (!itemId) return next(new AppError('Item ID is required', 400));

  const comparison = await vendorOptimizer.compareVendorsForItem(
    itemId,
    quantity || 1,
    preference || 'balanced'
  );

  res.status(200).json({ success: true, data: comparison });
});

// @desc    Optimize bulk order
// @route   POST /api/vendors/optimize-order
exports.optimizeOrder = asyncHandler(async (req, res, next) => {
  const { items, preference } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return next(new AppError('Items array is required', 400));
  }

  const optimization = await vendorOptimizer.optimizeBulkOrder(items, preference || 'balanced');
  res.status(200).json({ success: true, data: optimization });
});

// @desc    Get price history for item
// @route   GET /api/vendors/price-history/:itemId
exports.getPriceHistory = asyncHandler(async (req, res, next) => {
  const history = await vendorOptimizer.getPriceHistory(req.params.itemId);
  res.status(200).json({ success: true, data: history });
});
