const mongoose = require('mongoose');

const vendorPriceSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  minQuantity: {
    type: Number,
    default: 1
  },
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  expirationDate: {
    type: Date
  },
  notes: {
    type: String
  }
});

const vendorSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: [true, 'Vendor name is required'],
    trim: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    unique: true
  },
  
  // Contact Info
  contact: {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    fax: { type: String, trim: true }
  },
  
  // Address
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zip: { type: String, trim: true },
    country: { type: String, trim: true, default: 'USA' }
  },
  
  // Pricing for items
  prices: [vendorPriceSchema],
  
  // Performance metrics (auto-calculated)
  metrics: {
    avgLeadTime: { type: Number, default: 7 },
    onTimeDeliveryRate: { type: Number, default: 100 },
    totalOrders: { type: Number, default: 0 },
    lastOrderDate: { type: Date }
  },
  
  // Terms
  paymentTerms: {
    type: String,
    enum: ['net15', 'net30', 'net45', 'net60', 'cod', 'prepaid'],
    default: 'net30'
  },
  
  // Shipping
  shippingMethods: [{
    type: String
  }],
  freeShippingMinimum: {
    type: Number,
    default: 0
  },
  
  // Rating (1-5)
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  
  // Notes
  notes: {
    type: String
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isPreferred: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Virtual for full address
vendorSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  if (!addr.street) return '';
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
});

// Method to get price for an item
vendorSchema.methods.getPriceForItem = function(itemId, quantity = 1) {
  const now = new Date();
  
  // Find valid prices for this item
  const validPrices = this.prices.filter(p => {
    return p.item.toString() === itemId.toString() &&
           p.minQuantity <= quantity &&
           (!p.expirationDate || p.expirationDate >= now);
  });
  
  if (validPrices.length === 0) return null;
  
  // Return the best price (highest minQuantity that applies)
  validPrices.sort((a, b) => b.minQuantity - a.minQuantity);
  return validPrices[0];
};

// Method to add/update price for an item
vendorSchema.methods.setPrice = function(itemId, price, minQuantity = 1, expirationDate = null) {
  // Check if price already exists for this item and quantity tier
  const existingIndex = this.prices.findIndex(
    p => p.item.toString() === itemId.toString() && p.minQuantity === minQuantity
  );
  
  if (existingIndex >= 0) {
    this.prices[existingIndex].price = price;
    this.prices[existingIndex].effectiveDate = new Date();
    this.prices[existingIndex].expirationDate = expirationDate;
  } else {
    this.prices.push({
      item: itemId,
      price,
      minQuantity,
      effectiveDate: new Date(),
      expirationDate
    });
  }
  
  return this;
};

// Static: Find best vendor for an item
vendorSchema.statics.findBestVendor = async function(itemId, quantity = 1, preference = 'price') {
  const vendors = await this.find({ isActive: true }).lean();
  
  const vendorOptions = [];
  
  for (const vendor of vendors) {
    const validPrices = vendor.prices.filter(p => {
      const now = new Date();
      return p.item.toString() === itemId.toString() &&
             p.minQuantity <= quantity &&
             (!p.expirationDate || new Date(p.expirationDate) >= now);
    });
    
    if (validPrices.length > 0) {
      validPrices.sort((a, b) => b.minQuantity - a.minQuantity);
      const bestPrice = validPrices[0];
      
      vendorOptions.push({
        vendor: vendor,
        price: bestPrice.price,
        totalCost: bestPrice.price * quantity,
        leadTime: vendor.metrics.avgLeadTime,
        reliability: vendor.metrics.onTimeDeliveryRate,
        score: 0
      });
    }
  }
  
  if (vendorOptions.length === 0) return null;
  
  // Calculate scores based on preference
  // Normalize values and weight them
  const maxPrice = Math.max(...vendorOptions.map(v => v.price));
  const maxLeadTime = Math.max(...vendorOptions.map(v => v.leadTime));
  
  vendorOptions.forEach(option => {
    const priceScore = 1 - (option.price / maxPrice); // Lower is better
    const speedScore = 1 - (option.leadTime / maxLeadTime); // Lower is better
    const reliabilityScore = option.reliability / 100;
    
    if (preference === 'price') {
      option.score = (priceScore * 0.6) + (speedScore * 0.2) + (reliabilityScore * 0.2);
    } else if (preference === 'speed') {
      option.score = (priceScore * 0.2) + (speedScore * 0.6) + (reliabilityScore * 0.2);
    } else {
      option.score = (priceScore * 0.33) + (speedScore * 0.33) + (reliabilityScore * 0.34);
    }
  });
  
  // Sort by score (highest first)
  vendorOptions.sort((a, b) => b.score - a.score);
  
  return vendorOptions;
};

// Static: Compare vendors for an item
vendorSchema.statics.compareVendorsForItem = async function(itemId, quantity = 1) {
  return await this.findBestVendor(itemId, quantity, 'balanced');
};

// Indexes
vendorSchema.index({ code: 1 });
vendorSchema.index({ name: 1 });
vendorSchema.index({ 'prices.item': 1 });
vendorSchema.index({ isActive: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
