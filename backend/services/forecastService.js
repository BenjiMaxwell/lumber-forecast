/**
 * Forecast Service - TensorFlow.js LSTM Implementation
 * 
 * This service provides AI-powered demand forecasting using an LSTM
 * (Long Short-Term Memory) neural network trained on historical
 * consumption data.
 */

let tf = null;
try {
  tf = require('@tensorflow/tfjs-node');
} catch (error) {
  console.warn('TensorFlow.js not available. Forecast features will be limited.');
}

const { InventoryItem, InventoryCount } = require('../models');
const { logger } = require('../config/db');
const {
  getSeasonIndicator,
  getNormalizedDayOfYear,
  calculateDynamicMinimum,
  calculateTarget
} = require('../utils/seasonHelper');

// Model configuration
const CONFIG = {
  SEQUENCE_LENGTH: parseInt(process.env.SEQUENCE_LENGTH) || 12,
  FEATURES: 3,
  LSTM_UNITS_1: 64,
  LSTM_UNITS_2: 32,
  DENSE_UNITS: 16,
  DROPOUT_RATE: 0.2,
  EPOCHS: 100,
  BATCH_SIZE: 32,
  LEARNING_RATE: 0.001,
  VALIDATION_SPLIT: 0.2,
  FORECAST_DAYS: parseInt(process.env.FORECAST_DAYS) || 45
};

let globalModel = null;
const itemNormParams = new Map();

// Check if TensorFlow is available
const isTensorFlowAvailable = () => {
  if (!tf) {
    logger.warn('TensorFlow.js is not available. Forecast features are disabled.');
    return false;
  }
  return true;
};

// Create LSTM model architecture
const createModel = () => {
  if (!isTensorFlowAvailable()) {
    throw new Error('TensorFlow.js is not available');
  }
  const model = tf.sequential();
  
  model.add(tf.layers.lstm({
    units: CONFIG.LSTM_UNITS_1,
    returnSequences: true,
    inputShape: [CONFIG.SEQUENCE_LENGTH, CONFIG.FEATURES]
  }));
  
  model.add(tf.layers.dropout({ rate: CONFIG.DROPOUT_RATE }));
  
  model.add(tf.layers.lstm({
    units: CONFIG.LSTM_UNITS_2,
    returnSequences: false
  }));
  
  model.add(tf.layers.dropout({ rate: CONFIG.DROPOUT_RATE }));
  
  model.add(tf.layers.dense({
    units: CONFIG.DENSE_UNITS,
    activation: 'relu'
  }));
  
  model.add(tf.layers.dense({
    units: 1,
    activation: 'linear'
  }));
  
  model.compile({
    optimizer: tf.train.adam(CONFIG.LEARNING_RATE),
    loss: 'meanSquaredError',
    metrics: ['mae']
  });
  
  return model;
};

// Prepare data for training
const prepareItemData = async (itemId) => {
  const history = await InventoryCount.getConsumptionHistory(itemId, 52);
  
  if (history.length < CONFIG.SEQUENCE_LENGTH + 1) {
    return null;
  }
  
  const consumptions = history.map(h => h.consumption);
  const maxConsumption = Math.max(...consumptions) || 1;
  
  const features = history.map(h => ({
    consumption: h.consumption / maxConsumption,
    season: getSeasonIndicator(h.date),
    dayOfYear: getNormalizedDayOfYear(h.date)
  }));
  
  const sequences = [];
  const targets = [];
  
  for (let i = 0; i < features.length - CONFIG.SEQUENCE_LENGTH; i++) {
    sequences.push(features.slice(i, i + CONFIG.SEQUENCE_LENGTH)
      .map(f => [f.consumption, f.season, f.dayOfYear]));
    targets.push(features[i + CONFIG.SEQUENCE_LENGTH].consumption);
  }
  
  return { sequences, targets, maxConsumption, itemId };
};

// Prepare global training data
const prepareGlobalTrainingData = async () => {
  const items = await InventoryItem.find({ isActive: true });
  
  let allSequences = [];
  let allTargets = [];
  
  for (const item of items) {
    const data = await prepareItemData(item._id);
    if (data) {
      allSequences = allSequences.concat(data.sequences);
      allTargets = allTargets.concat(data.targets);
      itemNormParams.set(item._id.toString(), data.maxConsumption);
    }
  }
  
  return allSequences.length > 0 ? { sequences: allSequences, targets: allTargets } : null;
};

// Train global model
const trainGlobalModel = async () => {
  if (!isTensorFlowAvailable()) {
    logger.warn('Cannot train model: TensorFlow.js is not available');
    return null;
  }
  
  logger.info('Starting global model training...');
  
  const data = await prepareGlobalTrainingData();
  
  if (!data || data.sequences.length < 10) {
    logger.warn('Not enough training data');
    return null;
  }
  
  const xTrain = tf.tensor3d(data.sequences);
  const yTrain = tf.tensor2d(data.targets, [data.targets.length, 1]);
  
  const model = createModel();
  
  try {
    const history = await model.fit(xTrain, yTrain, {
      epochs: CONFIG.EPOCHS,
      batchSize: CONFIG.BATCH_SIZE,
      validationSplit: CONFIG.VALIDATION_SPLIT,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 20 === 0) {
            logger.info(`Epoch ${epoch}: loss=${logs.loss.toFixed(4)}`);
          }
        }
      }
    });
    
    globalModel = model;
    xTrain.dispose();
    yTrain.dispose();
    
    return {
      success: true,
      finalLoss: history.history.loss.slice(-1)[0],
      samplesUsed: data.sequences.length
    };
  } catch (error) {
    xTrain.dispose();
    yTrain.dispose();
    throw error;
  }
};

// Generate forecast for an item
const generateForecast = async (itemId, daysAhead = CONFIG.FORECAST_DAYS) => {
  const item = await InventoryItem.findById(itemId);
  if (!item) throw new Error('Item not found');
  
  const history = await InventoryCount.getConsumptionHistory(itemId, CONFIG.SEQUENCE_LENGTH);
  
  // If not enough history or no model, use simple average
  if (history.length < CONFIG.SEQUENCE_LENGTH || !globalModel) {
    const avgConsumption = await InventoryCount.calculateAvgConsumption(itemId);
    const totalPredicted = avgConsumption.daily * daysAhead;
    
    return {
      itemId,
      itemName: item.displayName || item.name,
      method: 'simple_average',
      currentStock: item.currentStock,
      predictions: generateSimplePredictions(avgConsumption.daily, daysAhead),
      summary: {
        totalPredictedDemand: Math.round(totalPredicted * 100) / 100,
        avgDailyDemand: avgConsumption.daily,
        daysUntilStockout: avgConsumption.daily > 0 
          ? Math.floor(item.currentStock / avgConsumption.daily) 
          : null,
        recommendedMin: calculateDynamicMinimum(avgConsumption.daily),
        recommendedTarget: calculateTarget(calculateDynamicMinimum(avgConsumption.daily))
      }
    };
  }
  
  // Use ML prediction
  const maxConsumption = itemNormParams.get(itemId.toString()) || 
    Math.max(...history.map(h => h.consumption)) || 1;
  
  // Prepare input sequence
  const inputFeatures = history.slice(-CONFIG.SEQUENCE_LENGTH).map(h => [
    h.consumption / maxConsumption,
    getSeasonIndicator(h.date),
    getNormalizedDayOfYear(h.date)
  ]);
  
  const predictions = [];
  let currentSequence = [...inputFeatures];
  let predictedDate = new Date();
  let cumulativeDemand = 0;
  
  // Generate predictions iteratively
  const weeksToPredict = Math.ceil(daysAhead / 7);
  
  for (let week = 0; week < weeksToPredict; week++) {
    const input = tf.tensor3d([currentSequence]);
    const prediction = globalModel.predict(input);
    const predictedValue = prediction.dataSync()[0] * maxConsumption;
    
    input.dispose();
    prediction.dispose();
    
    predictedDate = new Date(predictedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    cumulativeDemand += predictedValue;
    
    predictions.push({
      week: week + 1,
      date: predictedDate.toISOString().split('T')[0],
      predictedDemand: Math.round(predictedValue * 100) / 100,
      cumulativeDemand: Math.round(cumulativeDemand * 100) / 100,
      projectedStock: Math.round((item.currentStock - cumulativeDemand) * 100) / 100
    });
    
    // Update sequence for next prediction
    currentSequence.shift();
    currentSequence.push([
      predictedValue / maxConsumption,
      getSeasonIndicator(predictedDate),
      getNormalizedDayOfYear(predictedDate)
    ]);
  }
  
  const avgDailyDemand = cumulativeDemand / daysAhead;
  const daysUntilStockout = avgDailyDemand > 0 
    ? Math.floor(item.currentStock / avgDailyDemand) 
    : null;
  
  return {
    itemId,
    itemName: item.displayName || item.name,
    method: 'lstm',
    currentStock: item.currentStock,
    predictions,
    summary: {
      totalPredictedDemand: Math.round(cumulativeDemand * 100) / 100,
      avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
      daysUntilStockout,
      recommendedMin: calculateDynamicMinimum(avgDailyDemand),
      recommendedTarget: calculateTarget(calculateDynamicMinimum(avgDailyDemand)),
      stockoutDate: daysUntilStockout 
        ? new Date(Date.now() + daysUntilStockout * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null
    }
  };
};

// Simple predictions fallback
const generateSimplePredictions = (avgDaily, daysAhead) => {
  const predictions = [];
  let date = new Date();
  let cumulative = 0;
  
  for (let week = 1; week <= Math.ceil(daysAhead / 7); week++) {
    date = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weeklyDemand = avgDaily * 7;
    cumulative += weeklyDemand;
    
    predictions.push({
      week,
      date: date.toISOString().split('T')[0],
      predictedDemand: Math.round(weeklyDemand * 100) / 100,
      cumulativeDemand: Math.round(cumulative * 100) / 100
    });
  }
  
  return predictions;
};

// Update item's dynamic min/target based on forecast
const updateItemForecasts = async () => {
  const items = await InventoryItem.find({ isActive: true });
  const updates = [];
  
  for (const item of items) {
    try {
      const forecast = await generateForecast(item._id);
      
      await InventoryItem.findByIdAndUpdate(item._id, {
        dynamicMinimum: forecast.summary.recommendedMin,
        dynamicTarget: forecast.summary.recommendedTarget,
        avgDailyConsumption: forecast.summary.avgDailyDemand,
        avgWeeklyConsumption: forecast.summary.avgDailyDemand * 7,
        lastForecastUpdate: new Date()
      });
      
      updates.push({ itemId: item._id, success: true });
    } catch (error) {
      updates.push({ itemId: item._id, success: false, error: error.message });
    }
  }
  
  return updates;
};

// Batch forecast for all items
const generateBatchForecasts = async (daysAhead = CONFIG.FORECAST_DAYS) => {
  const items = await InventoryItem.find({ isActive: true });
  const forecasts = [];
  
  for (const item of items) {
    try {
      const forecast = await generateForecast(item._id, daysAhead);
      forecasts.push(forecast);
    } catch (error) {
      forecasts.push({
        itemId: item._id,
        itemName: item.displayName || item.name,
        error: error.message
      });
    }
  }
  
  return forecasts;
};

// Get items that need reordering
const getReorderRecommendations = async () => {
  const items = await InventoryItem.find({ isActive: true });
  const recommendations = [];
  
  for (const item of items) {
    const forecast = await generateForecast(item._id);
    const leadTime = item.avgLeadTime || 7;
    
    if (forecast.summary.daysUntilStockout !== null && 
        forecast.summary.daysUntilStockout <= leadTime + 5) {
      recommendations.push({
        item: {
          id: item._id,
          name: item.displayName || item.name,
          sku: item.sku,
          currentStock: item.currentStock
        },
        urgency: forecast.summary.daysUntilStockout <= leadTime ? 'critical' : 'high',
        daysUntilStockout: forecast.summary.daysUntilStockout,
        leadTime,
        recommendedOrderQty: Math.ceil(forecast.summary.recommendedTarget - item.currentStock),
        stockoutDate: forecast.summary.stockoutDate
      });
    }
  }
  
  return recommendations.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
};

module.exports = {
  trainGlobalModel,
  generateForecast,
  updateItemForecasts,
  generateBatchForecasts,
  getReorderRecommendations,
  isModelTrained: () => globalModel !== null
};
