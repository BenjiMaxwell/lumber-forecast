const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
  // Basic Info
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['dimensional', 'plywood', 'specialty', 'treated', 'composite', 'other'],
    default: 'dimensional'
  },
  
  // Dimensions (for lumber)
  dimensions: {
    thickness: { type: String }, // e.g., "2"
    width: { type: String },     // e.g., "4"
    length: { type: String }     // e.g., "16'"
  },
  
  // Units
  unitOfMeasure: {
    type: String,
    enum: ['pieces', 'board_feet', 'linear_feet', 'bundles', 'sheets'],
    default: 'pieces'
  },
  
  // Current Stock (supports fractional units)
  currentStock: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Stock cannot be negative']
  },
  
  // Seasonal Minimums (30-day supply)
  minimums: {
    winter: {
      type: Number,
      required: true,
      default: 0
    },
    summer: {
      type: Number,
      required: true,
      default: 0
    }
  },
  
  // Target is auto-calculated as minimum * 1.5 (45-day supply)
  // But can be overridden
  targetMultiplier: {
    type: Number,
    default: 1.5,
    min: 1,
    max: 3
  },
  
  // AI-adjusted dynamic minimums (updated by forecast service)
  dynamicMinimum: {
    type: Number,
    default: null
  },
  dynamicTarget: {
    type: Number,
    default: null
  },
  lastForecastUpdate: {
    type: Date
  },
  
  // Average consumption (calculated from history)
  avgDailyConsumption: {
    type: Number,
    default: 0
  },
  avgWeeklyConsumption: {
    type: Number,
    default: 0
  },
  
  // Lead time tracking (in days)
  avgLeadTime: {
    type: Number,
    default: 7
  },
  
  // Preferred vendor
  preferredVendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor'
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Location in warehouse
  location: {
    type: String,
    trim: true
  },
  
  // Notes
  notes: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for display name
inventoryItemSchema.virtual('displayName').get(function() {
  if (this.dimensions && this.dimensions.thickness && this.dimensions.width && this.dimensions.length) {
    return `${this.dimensions.thickness} x ${this.dimensions.width} - ${this.dimensions.length}`;
  }
  return this.name;
});

// Virtual for current minimum (based on season)
inventoryItemSchema.virtual('currentMinimum').get(function() {
  // Use dynamic if available, otherwise seasonal
  if (this.dynamicMinimum !== null) {
    return this.dynamicMinimum;
  }
  
  const month = new Date().getMonth() + 1; // 1-12
  const busySeasonStart = parseInt(process.env.BUSY_SEASON_START) || 4;
  const busySeasonEnd = parseInt(process.env.BUSY_SEASON_END) || 10;
  
  const isBusySeason = month >= busySeasonStart && month <= busySeasonEnd;
  return isBusySeason ? this.minimums.summer : this.minimums.winter;
});

// Virtual for current target
inventoryItemSchema.virtual('currentTarget').get(function() {
  if (this.dynamicTarget !== null) {
    return this.dynamicTarget;
  }
  return this.currentMinimum * this.targetMultiplier;
});

// Virtual for stock status
inventoryItemSchema.virtual('stockStatus').get(function() {
  const stock = this.currentStock;
  const min = this.currentMinimum;
  const target = this.currentTarget;
  
  if (stock <= 0) return 'out_of_stock';
  if (stock < min * 0.5) return 'critical';
  if (stock < min) return 'low';
  if (stock < target) return 'below_target';
  return 'adequate';
});

// Virtual for days until stockout (based on avg consumption)
inventoryItemSchema.virtual('daysUntilStockout').get(function() {
  if (this.avgDailyConsumption <= 0) return null;
  return Math.floor(this.currentStock / this.avgDailyConsumption);
});

// Virtual for reorder needed (considering lead time)
inventoryItemSchema.virtual('needsReorder').get(function() {
  const daysLeft = this.daysUntilStockout;
  if (daysLeft === null) return false;
  
  // Reorder if days until stockout is less than lead time + buffer
  const buffer = 5; // Extra days buffer
  return daysLeft <= (this.avgLeadTime + buffer);
});

// Indexes for common queries
inventoryItemSchema.index({ sku: 1 });
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ currentStock: 1 });
inventoryItemSchema.index({ isActive: 1 });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
