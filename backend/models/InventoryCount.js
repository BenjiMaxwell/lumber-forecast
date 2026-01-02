const mongoose = require('mongoose');

const inventoryCountSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  
  // The counted amount (supports fractions like 10.5)
  count: {
    type: Number,
    required: [true, 'Count value is required'],
    min: [0, 'Count cannot be negative']
  },
  
  // Previous count for comparison
  previousCount: {
    type: Number,
    default: 0
  },
  
  // Calculated change
  change: {
    type: Number,
    default: 0
  },
  
  // Who performed the count
  countedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // When the physical count was taken (might differ from createdAt)
  countDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // Notes for the count (e.g., "approximation", "partial unit")
  notes: {
    type: String,
    trim: true
  },
  
  // Flag for potential issues
  flagged: {
    type: Boolean,
    default: false
  },
  flagReason: {
    type: String,
    trim: true
  },
  
  // Was this count verified/reviewed?
  verified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  
  // Source of the count
  source: {
    type: String,
    enum: ['manual', 'csv_import', 'adjustment', 'delivery', 'sale'],
    default: 'manual'
  },
  
  // Week number for grouping (useful for ML)
  weekNumber: {
    type: Number
  },
  year: {
    type: Number
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate change and week info
inventoryCountSchema.pre('save', async function(next) {
  // Calculate week number
  const date = this.countDate || new Date();
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  this.weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  this.year = date.getFullYear();
  
  // Calculate change from previous count
  this.change = this.count - this.previousCount;
  
  next();
});

// Post-save middleware to update the InventoryItem's currentStock
inventoryCountSchema.post('save', async function() {
  const InventoryItem = mongoose.model('InventoryItem');
  await InventoryItem.findByIdAndUpdate(this.item, {
    currentStock: this.count
  });
});

// Static method to get consumption history for an item
inventoryCountSchema.statics.getConsumptionHistory = async function(itemId, weeks = 12) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeks * 7));
  
  const counts = await this.find({
    item: itemId,
    countDate: { $gte: startDate }
  })
  .sort({ countDate: 1 })
  .lean();
  
  // Calculate weekly consumption
  const weeklyConsumption = [];
  for (let i = 1; i < counts.length; i++) {
    const consumption = counts[i - 1].count - counts[i].count;
    const daysBetween = (counts[i].countDate - counts[i - 1].countDate) / (1000 * 60 * 60 * 24);
    
    if (daysBetween > 0) {
      weeklyConsumption.push({
        week: counts[i].weekNumber,
        year: counts[i].year,
        consumption: consumption > 0 ? consumption : 0,
        dailyRate: consumption > 0 ? consumption / daysBetween : 0,
        date: counts[i].countDate
      });
    }
  }
  
  return weeklyConsumption;
};

// Static method to calculate average consumption
inventoryCountSchema.statics.calculateAvgConsumption = async function(itemId) {
  const history = await this.getConsumptionHistory(itemId, 12);
  
  if (history.length === 0) {
    return { daily: 0, weekly: 0 };
  }
  
  const totalConsumption = history.reduce((sum, h) => sum + h.consumption, 0);
  const avgWeekly = totalConsumption / history.length;
  const avgDaily = avgWeekly / 7;
  
  return {
    daily: Math.round(avgDaily * 100) / 100,
    weekly: Math.round(avgWeekly * 100) / 100
  };
};

// Indexes
inventoryCountSchema.index({ item: 1, countDate: -1 });
inventoryCountSchema.index({ countDate: -1 });
inventoryCountSchema.index({ weekNumber: 1, year: 1 });
inventoryCountSchema.index({ flagged: 1 });

module.exports = mongoose.model('InventoryCount', inventoryCountSchema);
