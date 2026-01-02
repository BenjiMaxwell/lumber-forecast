const { Alert } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { anomalyService, reminderService } = require('../services');

// @desc    Get all alerts
// @route   GET /api/alerts
exports.getAlerts = asyncHandler(async (req, res, next) => {
  const { status, type, priority, page = 1, limit = 50 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (type) query.type = type;
  if (priority) query.priority = priority;

  const alerts = await Alert.find(query)
    .populate('item', 'name sku displayName')
    .populate('order', 'orderNumber')
    .populate('acknowledgedBy', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Alert.countDocuments(query);

  res.status(200).json({
    success: true,
    count: alerts.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: alerts
  });
});

// @desc    Get alert summary
// @route   GET /api/alerts/summary
exports.getAlertSummary = asyncHandler(async (req, res, next) => {
  const summary = await Alert.getAlertSummary();
  
  const activeAlerts = await Alert.find({ status: 'active' })
    .populate('item', 'name sku')
    .sort({ priority: -1, createdAt: -1 })
    .limit(10);

  res.status(200).json({
    success: true,
    data: {
      byPriority: summary,
      recentActive: activeAlerts
    }
  });
});

// @desc    Acknowledge alert
// @route   PUT /api/alerts/:id/acknowledge
exports.acknowledgeAlert = asyncHandler(async (req, res, next) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) return next(new AppError('Alert not found', 404));

  await alert.acknowledge(req.user.id);
  res.status(200).json({ success: true, data: alert });
});

// @desc    Resolve alert
// @route   PUT /api/alerts/:id/resolve
exports.resolveAlert = asyncHandler(async (req, res, next) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) return next(new AppError('Alert not found', 404));

  await alert.resolve(req.user.id, req.body.notes);
  res.status(200).json({ success: true, data: alert });
});

// @desc    Dismiss alert
// @route   PUT /api/alerts/:id/dismiss
exports.dismissAlert = asyncHandler(async (req, res, next) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) return next(new AppError('Alert not found', 404));

  await alert.dismiss(req.user.id);
  res.status(200).json({ success: true, data: alert });
});

// @desc    Get anomalies
// @route   GET /api/alerts/anomalies
exports.getAnomalies = asyncHandler(async (req, res, next) => {
  const { days = 7 } = req.query;
  const summary = await anomalyService.getAnomalySummary(parseInt(days));

  res.status(200).json({ success: true, data: summary });
});

// @desc    Run anomaly detection
// @route   POST /api/alerts/run-detection
exports.runAnomalyDetection = asyncHandler(async (req, res, next) => {
  const { hours = 24 } = req.body;
  const result = await anomalyService.runBatchAnalysis(parseInt(hours));

  res.status(200).json({ success: true, data: result });
});

// @desc    Trigger manual check
// @route   POST /api/alerts/check
exports.triggerCheck = asyncHandler(async (req, res, next) => {
  const { type } = req.body;

  let result;
  switch (type) {
    case 'low_stock':
      result = await reminderService.checkLowStock();
      break;
    case 'reorder':
      result = await reminderService.checkReorderNeeds();
      break;
    case 'deliveries':
      result = await reminderService.checkExpectedDeliveries();
      break;
    case 'daily_summary':
      result = await reminderService.sendDailySummary();
      break;
    default:
      return next(new AppError('Invalid check type', 400));
  }

  res.status(200).json({ success: true, data: result });
});
