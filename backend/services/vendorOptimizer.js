/**
 * Vendor Optimization Service
 * 
 * Analyzes vendor performance and pricing to recommend
 * the best purchasing options based on:
 * - Price
 * - Lead time / speed
 * - Reliability (on-time delivery rate)
 */

const { Vendor, Order, InventoryItem } = require('../models');
const { logger } = require('../config/db');

/**
 * Get vendor comparison for a specific item
 */
const compareVendorsForItem = async (itemId, quantity = 1, preference = 'balanced') => {
  const item = await InventoryItem.findById(itemId);
  if (!item) {
    throw new Error('Item not found');
  }
  
  const vendorOptions = await Vendor.findBestVendor(itemId, quantity, preference);
  
  if (!vendorOptions || vendorOptions.length === 0) {
    return {
      item: {
        id: item._id,
        name: item.displayName || item.name,
        sku: item.sku
      },
      vendors: [],
      message: 'No vendors have pricing for this item'
    };
  }
  
  // Enhance with additional details
  const enhancedOptions = await Promise.all(vendorOptions.map(async (option) => {
    // Get recent order history with this vendor for this item
    const recentOrders = await Order.find({
      vendor: option.vendor._id,
      'items.item': itemId,
      status: 'delivered'
    })
    .sort({ actualDeliveryDate: -1 })
    .limit(5);
    
    const lastOrder = recentOrders[0];
    
    return {
      vendor: {
        id: option.vendor._id,
        name: option.vendor.name,
        code: option.vendor.code
      },
      pricing: {
        unitPrice: option.price,
        totalCost: option.totalCost,
        freeShippingMinimum: option.vendor.freeShippingMinimum || 0,
        qualifiesForFreeShipping: option.totalCost >= (option.vendor.freeShippingMinimum || 0)
      },
      performance: {
        avgLeadTime: option.leadTime,
        reliability: option.reliability,
        totalOrders: option.vendor.metrics?.totalOrders || 0
      },
      lastOrder: lastOrder ? {
        date: lastOrder.orderDate,
        quantity: lastOrder.items.find(i => i.item.toString() === itemId.toString())?.quantity,
        price: lastOrder.items.find(i => i.item.toString() === itemId.toString())?.unitPrice
      } : null,
      score: Math.round(option.score * 100),
      recommendation: option.score === vendorOptions[0].score ? 'BEST MATCH' : null
    };
  }));
  
  return {
    item: {
      id: item._id,
      name: item.displayName || item.name,
      sku: item.sku
    },
    quantity,
    preference,
    vendors: enhancedOptions,
    recommendation: enhancedOptions[0]
  };
};

/**
 * Get best vendor for multiple items (bulk order)
 */
const optimizeBulkOrder = async (items, preference = 'balanced') => {
  // items: [{ itemId, quantity }]
  
  const itemDetails = await Promise.all(items.map(async (item) => {
    const inventoryItem = await InventoryItem.findById(item.itemId);
    return {
      ...item,
      name: inventoryItem?.displayName || inventoryItem?.name,
      sku: inventoryItem?.sku
    };
  }));
  
  // Find vendors that can supply all items
  const allVendors = await Vendor.find({ isActive: true });
  const vendorCoverage = [];
  
  for (const vendor of allVendors) {
    let canSupplyAll = true;
    let totalCost = 0;
    const itemPrices = [];
    
    for (const item of items) {
      const priceInfo = vendor.getPriceForItem(item.itemId, item.quantity);
      if (!priceInfo) {
        canSupplyAll = false;
        break;
      }
      
      const itemCost = priceInfo.price * item.quantity;
      totalCost += itemCost;
      itemPrices.push({
        itemId: item.itemId,
        unitPrice: priceInfo.price,
        subtotal: itemCost
      });
    }
    
    if (canSupplyAll) {
      vendorCoverage.push({
        vendor: {
          id: vendor._id,
          name: vendor.name,
          code: vendor.code
        },
        canSupplyAll: true,
        itemPrices,
        totalCost,
        avgLeadTime: vendor.metrics.avgLeadTime,
        reliability: vendor.metrics.onTimeDeliveryRate,
        freeShipping: totalCost >= (vendor.freeShippingMinimum || 0)
      });
    }
  }
  
  // If no single vendor can supply all, find combinations
  if (vendorCoverage.length === 0) {
    return await findVendorCombinations(items, allVendors, preference);
  }
  
  // Score and rank vendors
  const maxCost = Math.max(...vendorCoverage.map(v => v.totalCost));
  const maxLeadTime = Math.max(...vendorCoverage.map(v => v.avgLeadTime));
  
  vendorCoverage.forEach(vc => {
    const priceScore = 1 - (vc.totalCost / maxCost);
    const speedScore = 1 - (vc.avgLeadTime / maxLeadTime);
    const reliabilityScore = vc.reliability / 100;
    
    if (preference === 'price') {
      vc.score = (priceScore * 0.6) + (speedScore * 0.2) + (reliabilityScore * 0.2);
    } else if (preference === 'speed') {
      vc.score = (priceScore * 0.2) + (speedScore * 0.6) + (reliabilityScore * 0.2);
    } else {
      vc.score = (priceScore * 0.33) + (speedScore * 0.33) + (reliabilityScore * 0.34);
    }
  });
  
  vendorCoverage.sort((a, b) => b.score - a.score);
  
  return {
    items: itemDetails,
    preference,
    singleVendorOptions: vendorCoverage,
    recommendation: vendorCoverage[0],
    splitOrderRequired: false
  };
};

/**
 * Find optimal vendor combinations when no single vendor can supply all
 */
const findVendorCombinations = async (items, vendors, preference) => {
  // Build a map of which vendors can supply each item
  const itemVendorMap = new Map();
  
  for (const item of items) {
    const eligibleVendors = [];
    for (const vendor of vendors) {
      const priceInfo = vendor.getPriceForItem(item.itemId, item.quantity);
      if (priceInfo) {
        eligibleVendors.push({
          vendorId: vendor._id,
          vendorName: vendor.name,
          price: priceInfo.price,
          leadTime: vendor.metrics.avgLeadTime
        });
      }
    }
    itemVendorMap.set(item.itemId.toString(), eligibleVendors);
  }
  
  // Check if all items can be sourced
  const unsourceable = items.filter(
    item => !itemVendorMap.get(item.itemId.toString()) || 
            itemVendorMap.get(item.itemId.toString()).length === 0
  );
  
  if (unsourceable.length > 0) {
    return {
      items,
      preference,
      singleVendorOptions: [],
      splitOrderOptions: [],
      unsourceable: unsourceable.map(i => i.itemId),
      error: 'Some items cannot be sourced from any vendor'
    };
  }
  
  // Simple greedy approach: assign each item to cheapest vendor
  const assignments = [];
  const vendorOrders = new Map();
  
  for (const item of items) {
    const options = itemVendorMap.get(item.itemId.toString());
    
    // Sort by preference
    if (preference === 'price') {
      options.sort((a, b) => a.price - b.price);
    } else if (preference === 'speed') {
      options.sort((a, b) => a.leadTime - b.leadTime);
    }
    
    const best = options[0];
    
    if (!vendorOrders.has(best.vendorId.toString())) {
      vendorOrders.set(best.vendorId.toString(), {
        vendor: { id: best.vendorId, name: best.vendorName },
        items: [],
        totalCost: 0
      });
    }
    
    const vendorOrder = vendorOrders.get(best.vendorId.toString());
    const itemCost = best.price * item.quantity;
    vendorOrder.items.push({
      itemId: item.itemId,
      quantity: item.quantity,
      unitPrice: best.price,
      subtotal: itemCost
    });
    vendorOrder.totalCost += itemCost;
    
    assignments.push({
      itemId: item.itemId,
      vendor: best.vendorName,
      price: best.price
    });
  }
  
  return {
    items,
    preference,
    singleVendorOptions: [],
    splitOrderOptions: Array.from(vendorOrders.values()),
    splitOrderRequired: true,
    totalCost: Array.from(vendorOrders.values()).reduce((sum, vo) => sum + vo.totalCost, 0),
    assignments
  };
};

/**
 * Update vendor metrics based on order history
 */
const updateVendorMetrics = async (vendorId) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) return null;
  
  // Calculate metrics from orders
  const deliveredOrders = await Order.find({
    vendor: vendorId,
    status: 'delivered',
    leadTimeDays: { $exists: true }
  });
  
  if (deliveredOrders.length === 0) return vendor;
  
  // Average lead time
  const avgLeadTime = deliveredOrders.reduce((sum, o) => sum + o.leadTimeDays, 0) / deliveredOrders.length;
  
  // On-time delivery rate (delivered on or before expected date)
  const onTimeCount = deliveredOrders.filter(o => 
    o.actualDeliveryDate <= o.expectedDeliveryDate
  ).length;
  const onTimeRate = (onTimeCount / deliveredOrders.length) * 100;
  
  // Last order date
  const lastOrder = await Order.findOne({ vendor: vendorId }).sort({ orderDate: -1 });
  
  vendor.metrics = {
    avgLeadTime: Math.round(avgLeadTime * 10) / 10,
    onTimeDeliveryRate: Math.round(onTimeRate),
    totalOrders: deliveredOrders.length,
    lastOrderDate: lastOrder?.orderDate
  };
  
  await vendor.save();
  
  return vendor;
};

/**
 * Get price history for an item across vendors
 */
const getPriceHistory = async (itemId) => {
  const orders = await Order.find({
    'items.item': itemId,
    status: 'delivered'
  })
  .populate('vendor', 'name code')
  .sort({ orderDate: 1 });
  
  const priceHistory = orders.map(order => {
    const item = order.items.find(i => i.item.toString() === itemId.toString());
    return {
      date: order.orderDate,
      vendor: order.vendor?.name,
      price: item?.unitPrice,
      quantity: item?.quantity
    };
  });
  
  // Calculate price trends
  const pricesByVendor = {};
  priceHistory.forEach(ph => {
    if (!pricesByVendor[ph.vendor]) {
      pricesByVendor[ph.vendor] = [];
    }
    pricesByVendor[ph.vendor].push(ph.price);
  });
  
  const trends = {};
  Object.entries(pricesByVendor).forEach(([vendor, prices]) => {
    if (prices.length >= 2) {
      const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
      const secondHalf = prices.slice(Math.floor(prices.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      const pctChange = ((secondAvg - firstAvg) / firstAvg) * 100;
      trends[vendor] = {
        direction: pctChange > 2 ? 'increasing' : pctChange < -2 ? 'decreasing' : 'stable',
        percentChange: Math.round(pctChange * 10) / 10
      };
    }
  });
  
  return {
    itemId,
    priceHistory,
    trends,
    currentPrices: await getCurrentPrices(itemId)
  };
};

/**
 * Get current prices for an item from all vendors
 */
const getCurrentPrices = async (itemId) => {
  const vendors = await Vendor.find({ isActive: true });
  
  const prices = [];
  for (const vendor of vendors) {
    const price = vendor.getPriceForItem(itemId);
    if (price) {
      prices.push({
        vendor: vendor.name,
        vendorId: vendor._id,
        price: price.price,
        minQuantity: price.minQuantity,
        effectiveDate: price.effectiveDate
      });
    }
  }
  
  return prices.sort((a, b) => a.price - b.price);
};

module.exports = {
  compareVendorsForItem,
  optimizeBulkOrder,
  updateVendorMetrics,
  getPriceHistory,
  getCurrentPrices
};
