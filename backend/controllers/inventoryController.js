const { InventoryItem, InventoryCount } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { parseCSVString, transformToInventoryItems, validateImport } = require('../utils/csvParser');
const { anomalyService } = require('../services');

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private
exports.getItems = asyncHandler(async (req, res, next) => {
  const { 
    category, 
    status, 
    search, 
    sortBy = 'name', 
    order = 'asc',
    page = 1,
    limit = 50 
  } = req.query;

  const query = { isActive: true };

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } }
    ];
  }

  const items = await InventoryItem.find(query)
    .populate('preferredVendor', 'name code')
    .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await InventoryItem.countDocuments(query);

  // Add computed fields
  const itemsWithStatus = items.map(item => {
    const obj = item.toObject({ virtuals: true });
    return obj;
  });

  // Filter by status if requested
  let filteredItems = itemsWithStatus;
  if (status) {
    filteredItems = itemsWithStatus.filter(item => item.stockStatus === status);
  }

  res.status(200).json({
    success: true,
    count: filteredItems.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: filteredItems
  });
});

// @desc    Get single inventory item
// @route   GET /api/inventory/:id
// @access  Private
exports.getItem = asyncHandler(async (req, res, next) => {
  const item = await InventoryItem.findById(req.params.id)
    .populate('preferredVendor', 'name code contact');

  if (!item) {
    return next(new AppError('Item not found', 404));
  }

  // Get recent counts
  const recentCounts = await InventoryCount.find({ item: item._id })
    .sort({ countDate: -1 })
    .limit(10);

  // Get consumption stats
  const consumption = await InventoryCount.calculateAvgConsumption(item._id);

  res.status(200).json({
    success: true,
    data: {
      ...item.toObject({ virtuals: true }),
      recentCounts,
      consumption
    }
  });
});

// @desc    Create inventory item
// @route   POST /api/inventory
// @access  Private
exports.createItem = asyncHandler(async (req, res, next) => {
  const item = await InventoryItem.create(req.body);

  // Create initial count record if currentStock provided
  if (req.body.currentStock > 0) {
    await InventoryCount.create({
      item: item._id,
      count: req.body.currentStock,
      previousCount: 0,
      countedBy: req.user.id,
      source: 'manual',
      notes: 'Initial inventory'
    });
  }

  res.status(201).json({
    success: true,
    data: item
  });
});

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
// @access  Private
exports.updateItem = asyncHandler(async (req, res, next) => {
  let item = await InventoryItem.findById(req.params.id);

  if (!item) {
    return next(new AppError('Item not found', 404));
  }

  // Don't allow direct stock updates - use count endpoint
  delete req.body.currentStock;

  item = await InventoryItem.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: item
  });
});

// @desc    Delete inventory item (soft delete)
// @route   DELETE /api/inventory/:id
// @access  Private (Admin)
exports.deleteItem = asyncHandler(async (req, res, next) => {
  const item = await InventoryItem.findById(req.params.id);

  if (!item) {
    return next(new AppError('Item not found', 404));
  }

  // Soft delete
  item.isActive = false;
  await item.save();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Record inventory count
// @route   POST /api/inventory/:id/count
// @access  Private
exports.recordCount = asyncHandler(async (req, res, next) => {
  const item = await InventoryItem.findById(req.params.id);

  if (!item) {
    return next(new AppError('Item not found', 404));
  }

  const { count, notes, countDate } = req.body;

  if (count === undefined || count < 0) {
    return next(new AppError('Valid count value is required', 400));
  }

  const countRecord = await InventoryCount.create({
    item: item._id,
    count: parseFloat(count),
    previousCount: item.currentStock,
    countedBy: req.user.id,
    countDate: countDate ? new Date(countDate) : new Date(),
    notes,
    source: 'manual'
  });

  // Run anomaly detection on the new count
  const anomalyResult = await anomalyService.analyzeCount(countRecord._id);

  res.status(201).json({
    success: true,
    data: {
      count: countRecord,
      item: await InventoryItem.findById(item._id),
      anomalies: anomalyResult.anomalies
    }
  });
});

// @desc    Get count history for an item
// @route   GET /api/inventory/:id/history
// @access  Private
exports.getCountHistory = asyncHandler(async (req, res, next) => {
  const { weeks = 12, page = 1, limit = 50 } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeks * 7));

  const counts = await InventoryCount.find({
    item: req.params.id,
    countDate: { $gte: startDate }
  })
    .populate('countedBy', 'name')
    .sort({ countDate: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await InventoryCount.countDocuments({
    item: req.params.id,
    countDate: { $gte: startDate }
  });

  res.status(200).json({
    success: true,
    count: counts.length,
    total,
    data: counts
  });
});

// @desc    Import inventory from CSV
// @route   POST /api/inventory/import
// @access  Private
exports.importCSV = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please upload a CSV file', 400));
  }

  const csvContent = req.file.buffer.toString('utf-8');
  const records = await parseCSVString(csvContent);
  
  if (records.length === 0) {
    return next(new AppError('CSV file is empty', 400));
  }

  const { items, errors } = transformToInventoryItems(records);
  
  if (items.length === 0) {
    return next(new AppError('No valid items found in CSV', 400));
  }

  // Validate
  const validationIssues = validateImport(items);

  // Import items
  const results = {
    created: 0,
    updated: 0,
    failed: 0,
    details: []
  };

  for (const item of items) {
    try {
      // Check if item exists by SKU
      const existing = await InventoryItem.findOne({ sku: item.sku });

      if (existing) {
        // Update existing
        await InventoryItem.findByIdAndUpdate(existing._id, item);
        results.updated++;
        results.details.push({ sku: item.sku, action: 'updated' });
      } else {
        // Create new
        const newItem = await InventoryItem.create(item);
        
        // Create initial count
        if (item.currentStock > 0) {
          await InventoryCount.create({
            item: newItem._id,
            count: item.currentStock,
            previousCount: 0,
            countedBy: req.user.id,
            source: 'csv_import'
          });
        }
        
        results.created++;
        results.details.push({ sku: item.sku, action: 'created' });
      }
    } catch (error) {
      results.failed++;
      results.details.push({ 
        sku: item.sku, 
        action: 'failed', 
        error: error.message 
      });
    }
  }

  res.status(200).json({
    success: true,
    data: {
      ...results,
      parseErrors: errors,
      validationIssues
    }
  });
});

// @desc    Get inventory summary/dashboard stats
// @route   GET /api/inventory/summary
// @access  Private
exports.getSummary = asyncHandler(async (req, res, next) => {
  const items = await InventoryItem.find({ isActive: true });

  const summary = {
    totalItems: items.length,
    totalValue: 0, // Would need pricing data
    byStatus: {
      adequate: 0,
      below_target: 0,
      low: 0,
      critical: 0,
      out_of_stock: 0
    },
    byCategory: {},
    needsReorder: []
  };

  items.forEach(item => {
    const status = item.stockStatus;
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;

    const category = item.category || 'other';
    if (!summary.byCategory[category]) {
      summary.byCategory[category] = { count: 0, lowStock: 0 };
    }
    summary.byCategory[category].count++;
    if (['low', 'critical', 'out_of_stock'].includes(status)) {
      summary.byCategory[category].lowStock++;
    }

    if (item.needsReorder) {
      summary.needsReorder.push({
        id: item._id,
        name: item.displayName || item.name,
        sku: item.sku,
        currentStock: item.currentStock,
        minimum: item.currentMinimum,
        daysUntilStockout: item.daysUntilStockout
      });
    }
  });

  // Sort needs reorder by urgency
  summary.needsReorder.sort((a, b) => 
    (a.daysUntilStockout || 999) - (b.daysUntilStockout || 999)
  );

  res.status(200).json({
    success: true,
    data: summary
  });
});

// @desc    Bulk update counts (weekly count sheet)
// @route   POST /api/inventory/bulk-count
// @access  Private
exports.bulkCount = asyncHandler(async (req, res, next) => {
  const { counts, countDate } = req.body;
  // counts: [{ itemId, count, notes }]

  if (!counts || !Array.isArray(counts)) {
    return next(new AppError('Counts array is required', 400));
  }

  const results = {
    success: 0,
    failed: 0,
    anomalies: [],
    details: []
  };

  const date = countDate ? new Date(countDate) : new Date();

  for (const countData of counts) {
    try {
      const item = await InventoryItem.findById(countData.itemId);
      if (!item) {
        results.failed++;
        results.details.push({ 
          itemId: countData.itemId, 
          error: 'Item not found' 
        });
        continue;
      }

      const countRecord = await InventoryCount.create({
        item: item._id,
        count: parseFloat(countData.count),
        previousCount: item.currentStock,
        countedBy: req.user.id,
        countDate: date,
        notes: countData.notes,
        source: 'manual'
      });

      // Check for anomalies
      const anomalyResult = await anomalyService.analyzeCount(countRecord._id);
      if (anomalyResult.anomaliesDetected > 0) {
        results.anomalies.push({
          itemId: item._id,
          itemName: item.displayName || item.name,
          anomalies: anomalyResult.anomalies
        });
      }

      results.success++;
      results.details.push({ 
        itemId: item._id, 
        sku: item.sku,
        previousCount: item.currentStock,
        newCount: countData.count
      });
    } catch (error) {
      results.failed++;
      results.details.push({ 
        itemId: countData.itemId, 
        error: error.message 
      });
    }
  }

  res.status(200).json({
    success: true,
    data: results
  });
});
