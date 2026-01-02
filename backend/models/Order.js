const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [0.01, 'Quantity must be greater than 0']
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  totalPrice: {
    type: Number
  }
}, { _id: false });

// Calculate total price
orderItemSchema.pre('save', function(next) {
  this.totalPrice = this.quantity * this.unitPrice;
  next();
});

const orderSchema = new mongoose.Schema({
  // Order identification
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  
  // Vendor info
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: [true, 'Vendor is required']
  },
  
  // Items in the order
  items: [orderItemSchema],
  
  // Order totals
  subtotal: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['draft', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // Important dates
  orderDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expectedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  
  // Lead time (calculated when delivered)
  leadTimeDays: {
    type: Number
  },
  
  // Who placed/managed the order
  placedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // External references
  vendorOrderNumber: {
    type: String,
    trim: true
  },
  trackingNumber: {
    type: String,
    trim: true
  },
  
  // Notes
  notes: {
    type: String
  },
  
  // Status history
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String
  }]
}, {
  timestamps: true
});

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    // Find last order number for this month
    const lastOrder = await this.constructor.findOne({
      orderNumber: new RegExp(`^PO${year}${month}`)
    }).sort({ orderNumber: -1 });
    
    let sequence = 1;
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
      sequence = lastSequence + 1;
    }
    
    this.orderNumber = `PO${year}${month}${sequence.toString().padStart(4, '0')}`;
  }
  
  // Calculate totals
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);
  this.totalAmount = this.subtotal + (this.tax || 0) + (this.shipping || 0);
  
  next();
});

// Update lead time when marked as delivered
orderSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'delivered' && this.actualDeliveryDate) {
    const orderDate = this.orderDate || this.createdAt;
    const deliveryDate = this.actualDeliveryDate;
    this.leadTimeDays = Math.ceil((deliveryDate - orderDate) / (1000 * 60 * 60 * 24));
  }
  next();
});

// Add status to history when changed
orderSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date()
    });
  }
  next();
});

// Post-save: Update inventory when delivered
orderSchema.post('save', async function() {
  if (this.status === 'delivered') {
    const InventoryItem = mongoose.model('InventoryItem');
    const InventoryCount = mongoose.model('InventoryCount');
    
    for (const orderItem of this.items) {
      const item = await InventoryItem.findById(orderItem.item);
      if (item) {
        const newStock = item.currentStock + orderItem.quantity;
        
        // Create a count record for the delivery
        await InventoryCount.create({
          item: item._id,
          count: newStock,
          previousCount: item.currentStock,
          source: 'delivery',
          notes: `Delivery from order ${this.orderNumber}`,
          countDate: this.actualDeliveryDate || new Date()
        });
      }
    }
  }
});

// Static: Get average lead time for a vendor
orderSchema.statics.getVendorLeadTime = async function(vendorId) {
  const result = await this.aggregate([
    {
      $match: {
        vendor: vendorId,
        status: 'delivered',
        leadTimeDays: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        avgLeadTime: { $avg: '$leadTimeDays' },
        minLeadTime: { $min: '$leadTimeDays' },
        maxLeadTime: { $max: '$leadTimeDays' },
        orderCount: { $sum: 1 }
      }
    }
  ]);
  
  return result[0] || { avgLeadTime: 7, minLeadTime: 7, maxLeadTime: 7, orderCount: 0 };
};

// Static: Get lead time for specific item from specific vendor
orderSchema.statics.getItemLeadTime = async function(itemId, vendorId) {
  const result = await this.aggregate([
    {
      $match: {
        vendor: vendorId,
        status: 'delivered',
        'items.item': itemId,
        leadTimeDays: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        avgLeadTime: { $avg: '$leadTimeDays' },
        orderCount: { $sum: 1 }
      }
    }
  ]);
  
  return result[0] || null;
};

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ vendor: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderDate: -1 });
orderSchema.index({ 'items.item': 1 });

module.exports = mongoose.model('Order', orderSchema);
