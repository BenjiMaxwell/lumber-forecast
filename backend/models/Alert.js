const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  // Alert type
  type: {
    type: String,
    enum: [
      'low_stock',
      'critical_stock',
      'out_of_stock',
      'reorder_reminder',
      'anomaly_detected',
      'order_delayed',
      'price_increase',
      'delivery_expected',
      'forecast_update'
    ],
    required: true
  },
  
  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Title and message
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  
  // Related entities
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem'
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  },
  
  // For anomaly alerts - what was the issue?
  anomalyDetails: {
    expectedValue: Number,
    actualValue: Number,
    deviation: Number,
    countId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryCount' }
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'dismissed'],
    default: 'active'
  },
  
  // Email tracking
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date
  },
  
  // Who should see this
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Who handled it
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  acknowledgedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolvedAt: {
    type: Date
  },
  
  // Notes
  notes: {
    type: String
  },
  
  // Expiration (for time-sensitive alerts)
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Automatically set priority based on type
alertSchema.pre('save', function(next) {
  if (!this.isModified('type')) return next();
  
  const priorityMap = {
    'out_of_stock': 'critical',
    'critical_stock': 'critical',
    'anomaly_detected': 'high',
    'low_stock': 'high',
    'reorder_reminder': 'medium',
    'order_delayed': 'medium',
    'price_increase': 'low',
    'delivery_expected': 'low',
    'forecast_update': 'low'
  };
  
  this.priority = priorityMap[this.type] || 'medium';
  next();
});

// Static: Create low stock alert
alertSchema.statics.createLowStockAlert = async function(item) {
  const existing = await this.findOne({
    item: item._id,
    type: { $in: ['low_stock', 'critical_stock', 'out_of_stock'] },
    status: 'active'
  });
  
  if (existing) return existing;
  
  let type = 'low_stock';
  let title = `Low Stock: ${item.displayName || item.name}`;
  
  if (item.currentStock <= 0) {
    type = 'out_of_stock';
    title = `OUT OF STOCK: ${item.displayName || item.name}`;
  } else if (item.currentStock < item.currentMinimum * 0.5) {
    type = 'critical_stock';
    title = `CRITICAL Stock: ${item.displayName || item.name}`;
  }
  
  return await this.create({
    type,
    title,
    message: `Current stock: ${item.currentStock} units. Minimum: ${item.currentMinimum} units. Target: ${item.currentTarget} units.`,
    item: item._id,
    priority: type === 'out_of_stock' ? 'critical' : 'high'
  });
};

// Static: Create reorder reminder
alertSchema.statics.createReorderReminder = async function(item, daysUntilStockout, leadTime) {
  const existing = await this.findOne({
    item: item._id,
    type: 'reorder_reminder',
    status: 'active'
  });
  
  if (existing) return existing;
  
  return await this.create({
    type: 'reorder_reminder',
    title: `Reorder Needed: ${item.displayName || item.name}`,
    message: `Estimated ${daysUntilStockout} days until stockout. Lead time is ${leadTime} days. Order now to avoid running out.`,
    item: item._id,
    priority: daysUntilStockout < leadTime ? 'critical' : 'high'
  });
};

// Static: Create anomaly alert
alertSchema.statics.createAnomalyAlert = async function(item, details) {
  return await this.create({
    type: 'anomaly_detected',
    title: `Anomaly Detected: ${item.displayName || item.name}`,
    message: `Unexpected inventory change. Expected: ${details.expectedValue}, Actual: ${details.actualValue}. Deviation: ${details.deviation}%`,
    item: item._id,
    anomalyDetails: details,
    priority: 'high'
  });
};

// Method: Acknowledge alert
alertSchema.methods.acknowledge = async function(userId) {
  this.status = 'acknowledged';
  this.acknowledgedBy = userId;
  this.acknowledgedAt = new Date();
  return await this.save();
};

// Method: Resolve alert
alertSchema.methods.resolve = async function(userId, notes) {
  this.status = 'resolved';
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  if (notes) this.notes = notes;
  return await this.save();
};

// Method: Dismiss alert
alertSchema.methods.dismiss = async function(userId) {
  this.status = 'dismissed';
  this.acknowledgedBy = userId;
  this.acknowledgedAt = new Date();
  return await this.save();
};

// Static: Get active alerts summary
alertSchema.statics.getAlertSummary = async function() {
  return await this.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Indexes
alertSchema.index({ type: 1, status: 1 });
alertSchema.index({ item: 1 });
alertSchema.index({ status: 1 });
alertSchema.index({ priority: 1 });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Alert', alertSchema);
