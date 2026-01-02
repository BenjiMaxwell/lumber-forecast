const { InventoryItem } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { forecastService } = require('../services');

// @desc    Get forecast for single item
// @route   GET /api/forecasts/:itemId
exports.getForecast = asyncHandler(async (req, res, next) => {
  const { days } = req.query;

  const item = await InventoryItem.findById(req.params.itemId);
  if (!item) return next(new AppError('Item not found', 404));

  const forecast = await forecastService.generateForecast(
    req.params.itemId,
    days ? parseInt(days) : undefined
  );

  res.status(200).json({ success: true, data: forecast });
});

// @desc    Get batch forecasts for all items
// @route   GET /api/forecasts/batch
exports.getBatchForecasts = asyncHandler(async (req, res, next) => {
  const { days } = req.query;
  const forecasts = await forecastService.generateBatchForecasts(days ? parseInt(days) : undefined);

  res.status(200).json({
    success: true,
    count: forecasts.length,
    data: forecasts
  });
});

// @desc    Get reorder recommendations
// @route   GET /api/forecasts/reorder-recommendations
exports.getReorderRecommendations = asyncHandler(async (req, res, next) => {
  const recommendations = await forecastService.getReorderRecommendations();

  res.status(200).json({
    success: true,
    count: recommendations.length,
    data: recommendations
  });
});

// @desc    Trigger model retraining
// @route   POST /api/forecasts/retrain
exports.retrainModel = asyncHandler(async (req, res, next) => {
  const result = await forecastService.trainGlobalModel();

  if (!result) {
    return res.status(200).json({
      success: true,
      message: 'Not enough data to train model',
      data: null
    });
  }

  res.status(200).json({
    success: true,
    message: 'Model retrained successfully',
    data: result
  });
});

// @desc    Update all item forecasts
// @route   POST /api/forecasts/update-all
exports.updateAllForecasts = asyncHandler(async (req, res, next) => {
  const updates = await forecastService.updateItemForecasts();

  const successful = updates.filter(u => u.success).length;
  const failed = updates.filter(u => !u.success).length;

  res.status(200).json({
    success: true,
    message: `Updated ${successful} items, ${failed} failed`,
    data: updates
  });
});

// @desc    Get model status
// @route   GET /api/forecasts/model-status
exports.getModelStatus = asyncHandler(async (req, res, next) => {
  const isTrained = forecastService.isModelTrained();

  res.status(200).json({
    success: true,
    data: {
      modelTrained: isTrained,
      lastTraining: null, // Would need to track this
      sequenceLength: parseInt(process.env.SEQUENCE_LENGTH) || 12,
      forecastDays: parseInt(process.env.FORECAST_DAYS) || 45
    }
  });
});
