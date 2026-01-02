const { Order, Vendor, InventoryItem } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
exports.getOrders = asyncHandler(async (req, res, next) => {
  const {
    status,
    vendor,
    startDate,
    endDate,
    sortBy = 'orderDate',
    order = 'desc',
    page = 1,
    limit = 25
  } = req.query;

  const query = {};

  if (status) {
    query.status = status;
  }

  if (vendor) {
    query.vendor = vendor;
  }

  if (startDate || endDate) {
    query.orderDate = {};
    if (startDate) query.orderDate.$gte = new Date(startDate);
    if (endDate) query.orderDate.$lte = new Date(endDate);
  }

  const orders = await Order.find(query)
    .populate('vendor', 'name code')
    .populate('items.item', 'name sku displayName')
    .populate('placedBy', 'name')
    .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Order.countDocuments(query);

  res.status(200).json({
    success: true,
    count: orders.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: orders
  });
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('vendor')
    .populate('items.item')
    .populate('placedBy', 'name email')
    .populate('statusHistory.changedBy', 'name');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  res.status(200).json({
    success: true,
    data: order
  });
});

// @desc    Create order
// @route   POST /api/orders
// @access  Private
exports.createOrder = asyncHandler(async (req, res, next) => {
  const { vendor, items, expectedDeliveryDate, notes, vendorOrderNumber } = req.body;

  // Validate vendor
  const vendorDoc = await Vendor.findById(vendor);
  if (!vendorDoc) {
    return next(new AppError('Vendor not found', 404));
  }

  // Validate items
  if (!items || items.length === 0) {
    return next(new AppError('At least one item is required', 400));
  }

  // Validate each item
  const orderItems = [];
  for (const item of items) {
    const inventoryItem = await InventoryItem.findById(item.item);
    if (!inventoryItem) {
      return next(new AppError(`Item ${item.item} not found`, 404));
    }

    // Get price from vendor if not provided
    let unitPrice = item.unitPrice;
    if (!unitPrice) {
      const vendorPrice = vendorDoc.getPriceForItem(item.item, item.quantity);
      unitPrice = vendorPrice ? vendorPrice.price : 0;
    }

    orderItems.push({
      item: item.item,
      quantity: item.quantity,
      unitPrice
    });
  }

  const order = await Order.create({
    vendor,
    items: orderItems,
    expectedDeliveryDate: expectedDeliveryDate 
      ? new Date(expectedDeliveryDate) 
      : new Date(Date.now() + vendorDoc.metrics.avgLeadTime * 24 * 60 * 60 * 1000),
    notes,
    vendorOrderNumber,
    placedBy: req.user.id,
    status: 'pending'
  });

  const populatedOrder = await Order.findById(order._id)
    .populate('vendor', 'name code')
    .populate('items.item', 'name sku');

  res.status(201).json({
    success: true,
    data: populatedOrder
  });
});

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
exports.updateStatus = asyncHandler(async (req, res, next) => {
  const { status, actualDeliveryDate, trackingNumber, notes } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Validate status transition
  const validTransitions = {
    draft: ['pending', 'cancelled'],
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: []
  };

  if (!validTransitions[order.status].includes(status)) {
    return next(new AppError(
      `Cannot transition from ${order.status} to ${status}`, 
      400
    ));
  }

  order.status = status;

  if (trackingNumber) {
    order.trackingNumber = trackingNumber;
  }

  if (status === 'delivered') {
    order.actualDeliveryDate = actualDeliveryDate 
      ? new Date(actualDeliveryDate) 
      : new Date();
  }

  // Add to history
  order.statusHistory.push({
    status,
    changedBy: req.user.id,
    notes
  });

  await order.save();

  // If delivered, update vendor metrics
  if (status === 'delivered') {
    const { vendorOptimizer } = require('../services');
    await vendorOptimizer.updateVendorMetrics(order.vendor);
  }

  const updatedOrder = await Order.findById(order._id)
    .populate('vendor', 'name')
    .populate('items.item', 'name sku');

  res.status(200).json({
    success: true,
    data: updatedOrder
  });
});

// @desc    Update order details
// @route   PUT /api/orders/:id
// @access  Private
exports.updateOrder = asyncHandler(async (req, res, next) => {
  let order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Only allow updates to draft or pending orders
  if (!['draft', 'pending'].includes(order.status)) {
    return next(new AppError('Cannot modify order after it has been confirmed', 400));
  }

  const { items, expectedDeliveryDate, notes, vendorOrderNumber, tax, shipping } = req.body;

  if (items) {
    order.items = items;
  }
  if (expectedDeliveryDate) {
    order.expectedDeliveryDate = new Date(expectedDeliveryDate);
  }
  if (notes !== undefined) {
    order.notes = notes;
  }
  if (vendorOrderNumber !== undefined) {
    order.vendorOrderNumber = vendorOrderNumber;
  }
  if (tax !== undefined) {
    order.tax = tax;
  }
  if (shipping !== undefined) {
    order.shipping = shipping;
  }

  await order.save();

  const updatedOrder = await Order.findById(order._id)
    .populate('vendor', 'name')
    .populate('items.item', 'name sku');

  res.status(200).json({
    success: true,
    data: updatedOrder
  });
});

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private (Admin)
exports.deleteOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Only allow deletion of draft orders
  if (order.status !== 'draft') {
    return next(new AppError('Only draft orders can be deleted', 400));
  }

  await order.deleteOne();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get average lead times
// @route   GET /api/orders/lead-times
// @access  Private
exports.getLeadTimes = asyncHandler(async (req, res, next) => {
  const vendors = await Vendor.find({ isActive: true });
  
  const leadTimes = [];

  for (const vendor of vendors) {
    const vendorLeadTime = await Order.getVendorLeadTime(vendor._id);
    
    leadTimes.push({
      vendor: {
        id: vendor._id,
        name: vendor.name,
        code: vendor.code
      },
      avgLeadTime: Math.round(vendorLeadTime.avgLeadTime * 10) / 10,
      minLeadTime: vendorLeadTime.minLeadTime,
      maxLeadTime: vendorLeadTime.maxLeadTime,
      orderCount: vendorLeadTime.orderCount
    });
  }

  res.status(200).json({
    success: true,
    data: leadTimes
  });
});

// @desc    Get orders for a specific item
// @route   GET /api/orders/item/:itemId
// @access  Private
exports.getOrdersForItem = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({
    'items.item': req.params.itemId
  })
    .populate('vendor', 'name')
    .sort({ orderDate: -1 })
    .limit(20);

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get pending orders summary
// @route   GET /api/orders/pending-summary
// @access  Private
exports.getPendingSummary = asyncHandler(async (req, res, next) => {
  const pendingOrders = await Order.find({
    status: { $in: ['pending', 'confirmed', 'shipped'] }
  })
    .populate('vendor', 'name')
    .populate('items.item', 'name sku')
    .sort({ expectedDeliveryDate: 1 });

  // Group by status
  const byStatus = {
    pending: [],
    confirmed: [],
    shipped: []
  };

  pendingOrders.forEach(order => {
    byStatus[order.status].push({
      id: order._id,
      orderNumber: order.orderNumber,
      vendor: order.vendor?.name,
      itemCount: order.items.length,
      totalAmount: order.totalAmount,
      expectedDelivery: order.expectedDeliveryDate
    });
  });

  // Items on order
  const incomingItems = {};
  pendingOrders.forEach(order => {
    order.items.forEach(item => {
      const key = item.item._id.toString();
      if (!incomingItems[key]) {
        incomingItems[key] = {
          item: item.item,
          totalQuantity: 0,
          orders: []
        };
      }
      incomingItems[key].totalQuantity += item.quantity;
      incomingItems[key].orders.push(order.orderNumber);
    });
  });

  res.status(200).json({
    success: true,
    data: {
      summary: {
        total: pendingOrders.length,
        pending: byStatus.pending.length,
        confirmed: byStatus.confirmed.length,
        shipped: byStatus.shipped.length
      },
      byStatus,
      incomingItems: Object.values(incomingItems)
    }
  });
});
