/**
 * Anomaly Detection Service
 * 
 * Detects suspicious patterns in inventory data such as:
 * - Unexplained stock increases (no purchase order)
 * - Unusual consumption spikes
 * - Data entry errors
 */

const { InventoryItem, InventoryCount, Order, Alert } = require('../models');
const { logger } = require('../config/db');

// Configuration
const CONFIG = {
  // Standard deviation multiplier for anomaly threshold
  ANOMALY_THRESHOLD: 2.5,
  // Minimum data points needed for statistical analysis
  MIN_DATA_POINTS: 4,
  // Maximum acceptable percentage change without explanation
  MAX_UNEXPLAINED_INCREASE_PCT: 5,
  // Check for these types of anomalies
  DETECTION_TYPES: [
    'unexplained_increase',
    'unusual_decrease',
    'data_entry_error',
    'consumption_spike'
  ]
};

/**
 * Calculate statistics for an item's count history
 */
const calculateStatistics = (counts) => {
  if (counts.length < 2) {
    return null;
  }
  
  const changes = [];
  for (let i = 1; i < counts.length; i++) {
    changes.push(counts[i].count - counts[i - 1].count);
  }
  
  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
  const variance = changes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / changes.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, stdDev, changes };
};

/**
 * Check if a change is statistically anomalous
 */
const isAnomalousChange = (change, stats) => {
  if (!stats || stats.stdDev === 0) {
    return false;
  }
  
  const zScore = Math.abs(change - stats.mean) / stats.stdDev;
  return zScore > CONFIG.ANOMALY_THRESHOLD;
};

/**
 * Check for unexplained stock increases
 * Stock should only increase via deliveries
 */
const detectUnexplainedIncrease = async (item, latestCount, previousCount) => {
  if (!previousCount || latestCount.count <= previousCount.count) {
    return null;
  }
  
  const increase = latestCount.count - previousCount.count;
  const pctIncrease = (increase / previousCount.count) * 100;
  
  // Small increases might be counting corrections
  if (pctIncrease <= CONFIG.MAX_UNEXPLAINED_INCREASE_PCT) {
    return null;
  }
  
  // Check if there was a delivery between counts
  const deliveries = await Order.find({
    'items.item': item._id,
    status: 'delivered',
    actualDeliveryDate: {
      $gte: previousCount.countDate,
      $lte: latestCount.countDate
    }
  });
  
  // Calculate total delivered quantity
  let deliveredQty = 0;
  for (const order of deliveries) {
    const orderItem = order.items.find(i => i.item.toString() === item._id.toString());
    if (orderItem) {
      deliveredQty += orderItem.quantity;
    }
  }
  
  // Check if increase is explained by deliveries
  const unexplainedIncrease = increase - deliveredQty;
  
  if (unexplainedIncrease > item.currentStock * 0.05) { // More than 5% unexplained
    return {
      type: 'unexplained_increase',
      severity: unexplainedIncrease > item.currentStock * 0.2 ? 'high' : 'medium',
      details: {
        previousCount: previousCount.count,
        currentCount: latestCount.count,
        totalIncrease: increase,
        deliveredQty,
        unexplainedAmount: unexplainedIncrease,
        percentageIncrease: Math.round(pctIncrease * 10) / 10
      },
      message: `Stock increased by ${increase} units but only ${deliveredQty} units were delivered. ${unexplainedIncrease} units unexplained.`
    };
  }
  
  return null;
};

/**
 * Check for unusual consumption spikes
 */
const detectConsumptionSpike = async (item, latestCount, previousCount, stats) => {
  if (!previousCount || !stats) {
    return null;
  }
  
  const change = latestCount.count - previousCount.count;
  
  // We're looking for unusual decreases (consumption)
  if (change >= 0) {
    return null;
  }
  
  const consumption = Math.abs(change);
  
  if (isAnomalousChange(change, stats)) {
    const expectedConsumption = Math.abs(stats.mean);
    const deviation = ((consumption - expectedConsumption) / expectedConsumption) * 100;
    
    return {
      type: 'consumption_spike',
      severity: deviation > 200 ? 'high' : 'medium',
      details: {
        consumption,
        expectedConsumption: Math.round(expectedConsumption * 10) / 10,
        deviation: Math.round(deviation),
        previousCount: previousCount.count,
        currentCount: latestCount.count
      },
      message: `Consumption of ${consumption} units is ${Math.round(deviation)}% higher than expected ${Math.round(expectedConsumption)} units.`
    };
  }
  
  return null;
};

/**
 * Check for potential data entry errors
 */
const detectDataEntryError = async (item, latestCount, previousCount) => {
  if (!previousCount) {
    return null;
  }
  
  const change = Math.abs(latestCount.count - previousCount.count);
  const pctChange = (change / previousCount.count) * 100;
  
  // Massive changes (>90%) are likely errors
  if (pctChange > 90 && change > 10) {
    // Check if this looks like a decimal error (e.g., 150 instead of 15.0)
    const ratio = latestCount.count / previousCount.count;
    const isDecimalError = Math.abs(ratio - 10) < 0.5 || Math.abs(ratio - 0.1) < 0.05;
    
    if (isDecimalError) {
      return {
        type: 'data_entry_error',
        severity: 'high',
        details: {
          previousCount: previousCount.count,
          currentCount: latestCount.count,
          suspectedCorrectValue: ratio > 1 ? latestCount.count / 10 : latestCount.count * 10,
          changePercentage: Math.round(pctChange)
        },
        message: `Possible decimal error: count changed from ${previousCount.count} to ${latestCount.count}. Should this be ${ratio > 1 ? latestCount.count / 10 : latestCount.count * 10}?`
      };
    }
    
    // Otherwise just flag as potential error
    return {
      type: 'data_entry_error',
      severity: 'medium',
      details: {
        previousCount: previousCount.count,
        currentCount: latestCount.count,
        changePercentage: Math.round(pctChange)
      },
      message: `Unusually large change: ${pctChange.toFixed(0)}% difference from last count. Please verify.`
    };
  }
  
  return null;
};

/**
 * Run all anomaly checks on a single count
 */
const analyzeCount = async (countId) => {
  const count = await InventoryCount.findById(countId).populate('item');
  if (!count) {
    throw new Error('Count not found');
  }
  
  const item = count.item;
  
  // Get previous count
  const previousCount = await InventoryCount.findOne({
    item: item._id,
    countDate: { $lt: count.countDate }
  }).sort({ countDate: -1 });
  
  // Get statistics from history
  const recentCounts = await InventoryCount.find({
    item: item._id,
    countDate: { $lte: count.countDate }
  }).sort({ countDate: -1 }).limit(20);
  
  const stats = calculateStatistics(recentCounts.reverse());
  
  // Run all detection algorithms
  const anomalies = [];
  
  const unexplainedIncrease = await detectUnexplainedIncrease(item, count, previousCount);
  if (unexplainedIncrease) anomalies.push(unexplainedIncrease);
  
  const consumptionSpike = await detectConsumptionSpike(item, count, previousCount, stats);
  if (consumptionSpike) anomalies.push(consumptionSpike);
  
  const dataError = await detectDataEntryError(item, count, previousCount);
  if (dataError) anomalies.push(dataError);
  
  // Create alerts for detected anomalies
  for (const anomaly of anomalies) {
    await Alert.createAnomalyAlert(item, {
      expectedValue: previousCount ? previousCount.count : 0,
      actualValue: count.count,
      deviation: anomaly.details.changePercentage || 0,
      countId: count._id,
      anomalyType: anomaly.type
    });
    
    // Flag the count
    await InventoryCount.findByIdAndUpdate(count._id, {
      flagged: true,
      flagReason: anomaly.message
    });
  }
  
  return {
    countId: count._id,
    itemId: item._id,
    itemName: item.displayName || item.name,
    anomaliesDetected: anomalies.length,
    anomalies
  };
};

/**
 * Run anomaly detection on all recent counts
 */
const runBatchAnalysis = async (hoursBack = 24) => {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  
  const recentCounts = await InventoryCount.find({
    createdAt: { $gte: since },
    flagged: { $ne: true } // Skip already flagged
  });
  
  const results = [];
  
  for (const count of recentCounts) {
    try {
      const analysis = await analyzeCount(count._id);
      if (analysis.anomaliesDetected > 0) {
        results.push(analysis);
      }
    } catch (error) {
      logger.error(`Error analyzing count ${count._id}:`, error);
    }
  }
  
  return {
    countsAnalyzed: recentCounts.length,
    anomaliesFound: results.reduce((sum, r) => sum + r.anomaliesDetected, 0),
    details: results
  };
};

/**
 * Get summary of recent anomalies
 */
const getAnomalySummary = async (daysBack = 7) => {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
  
  const alerts = await Alert.find({
    type: 'anomaly_detected',
    createdAt: { $gte: since }
  })
  .populate('item', 'name sku displayName')
  .sort({ createdAt: -1 });
  
  const byType = {};
  alerts.forEach(alert => {
    const type = alert.anomalyDetails?.anomalyType || 'unknown';
    if (!byType[type]) byType[type] = [];
    byType[type].push(alert);
  });
  
  return {
    total: alerts.length,
    byType,
    recentAlerts: alerts.slice(0, 10)
  };
};

module.exports = {
  analyzeCount,
  runBatchAnalysis,
  getAnomalySummary,
  detectUnexplainedIncrease,
  detectConsumptionSpike,
  detectDataEntryError
};
