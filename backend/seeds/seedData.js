require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');
const { User, InventoryItem, InventoryCount, Vendor, Order, Alert } = require('../models');

const seedData = async () => {
  try {
    await connectDB();
    
    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await InventoryItem.deleteMany({});
    await InventoryCount.deleteMany({});
    await Vendor.deleteMany({});
    await Order.deleteMany({});
    await Alert.deleteMany({});

    // Create demo user
    console.log('Creating demo user...');
    const user = await User.create({
      name: 'Demo Purchaser',
      email: 'demo@lumberflow.com',
      password: 'Demo123!',
      role: 'purchaser'
    });

    // Create vendors
    console.log('Creating vendors...');
    const vendors = await Vendor.insertMany([
      {
        name: 'Pacific Lumber Supply',
        code: 'PLS',
        contact: { name: 'John Smith', email: 'john@pacificlumber.com', phone: '555-0101' },
        address: { street: '123 Mill Rd', city: 'Portland', state: 'OR', zip: '97201' },
        paymentTerms: 'net30',
        metrics: { avgLeadTime: 5, onTimeDeliveryRate: 95, totalOrders: 150 },
        rating: 4,
        isPreferred: true
      },
      {
        name: 'Mountain Wood Co',
        code: 'MWC',
        contact: { name: 'Sarah Johnson', email: 'sarah@mountainwood.com', phone: '555-0102' },
        address: { street: '456 Forest Ave', city: 'Seattle', state: 'WA', zip: '98101' },
        paymentTerms: 'net30',
        metrics: { avgLeadTime: 7, onTimeDeliveryRate: 88, totalOrders: 80 },
        rating: 3
      },
      {
        name: 'Valley Timber',
        code: 'VT',
        contact: { name: 'Mike Brown', email: 'mike@valleytimber.com', phone: '555-0103' },
        address: { street: '789 Oak St', city: 'Sacramento', state: 'CA', zip: '95814' },
        paymentTerms: 'net15',
        metrics: { avgLeadTime: 3, onTimeDeliveryRate: 92, totalOrders: 200 },
        rating: 5
      }
    ]);

    // Create inventory items
    console.log('Creating inventory items...');
    const items = await InventoryItem.insertMany([
      { sku: 'LUM-2X4-8', name: '2x4 Lumber 8ft', dimensions: { thickness: '2', width: '4', length: "8'" }, category: 'dimensional', currentStock: 150, minimums: { winter: 100, summer: 200 }, avgLeadTime: 5 },
      { sku: 'LUM-2X4-10', name: '2x4 Lumber 10ft', dimensions: { thickness: '2', width: '4', length: "10'" }, category: 'dimensional', currentStock: 120, minimums: { winter: 80, summer: 160 }, avgLeadTime: 5 },
      { sku: 'LUM-2X4-12', name: '2x4 Lumber 12ft', dimensions: { thickness: '2', width: '4', length: "12'" }, category: 'dimensional', currentStock: 85, minimums: { winter: 60, summer: 120 }, avgLeadTime: 5 },
      { sku: 'LUM-2X4-16', name: '2x4 Lumber 16ft', dimensions: { thickness: '2', width: '4', length: "16'" }, category: 'dimensional', currentStock: 45, minimums: { winter: 40, summer: 80 }, avgLeadTime: 7 },
      { sku: 'LUM-2X6-8', name: '2x6 Lumber 8ft', dimensions: { thickness: '2', width: '6', length: "8'" }, category: 'dimensional', currentStock: 100, minimums: { winter: 70, summer: 140 }, avgLeadTime: 5 },
      { sku: 'LUM-2X6-12', name: '2x6 Lumber 12ft', dimensions: { thickness: '2', width: '6', length: "12'" }, category: 'dimensional', currentStock: 75, minimums: { winter: 50, summer: 100 }, avgLeadTime: 5 },
      { sku: 'LUM-2X6-16', name: '2x6 Lumber 16ft', dimensions: { thickness: '2', width: '6', length: "16'" }, category: 'dimensional', currentStock: 30, minimums: { winter: 30, summer: 60 }, avgLeadTime: 7 },
      { sku: 'LUM-4X4-8', name: '4x4 Post 8ft', dimensions: { thickness: '4', width: '4', length: "8'" }, category: 'dimensional', currentStock: 60, minimums: { winter: 40, summer: 80 }, avgLeadTime: 5 },
      { sku: 'PLY-3/4-4X8', name: '3/4" Plywood 4x8', dimensions: { thickness: '3/4', width: '48', length: '96' }, category: 'plywood', currentStock: 80, minimums: { winter: 50, summer: 100 }, avgLeadTime: 4 },
      { sku: 'PLY-1/2-4X8', name: '1/2" Plywood 4x8', dimensions: { thickness: '1/2', width: '48', length: '96' }, category: 'plywood', currentStock: 90, minimums: { winter: 60, summer: 120 }, avgLeadTime: 4 },
      { sku: 'TRT-2X4-8', name: 'Treated 2x4 8ft', dimensions: { thickness: '2', width: '4', length: "8'" }, category: 'treated', currentStock: 70, minimums: { winter: 50, summer: 100 }, avgLeadTime: 6 },
      { sku: 'TRT-2X6-12', name: 'Treated 2x6 12ft', dimensions: { thickness: '2', width: '6', length: "12'" }, category: 'treated', currentStock: 40, minimums: { winter: 30, summer: 60 }, avgLeadTime: 6 },
      { sku: 'TRT-4X4-8', name: 'Treated 4x4 Post 8ft', dimensions: { thickness: '4', width: '4', length: "8'" }, category: 'treated', currentStock: 35, minimums: { winter: 25, summer: 50 }, avgLeadTime: 7 }
    ]);

    // Add prices to vendors
    console.log('Setting vendor prices...');
    for (const vendor of vendors) {
      for (const item of items) {
        const basePrice = Math.random() * 5 + 3; // $3-8 per unit
        vendor.setPrice(item._id, Math.round(basePrice * 100) / 100, 1);
        // Volume discount
        vendor.setPrice(item._id, Math.round(basePrice * 0.9 * 100) / 100, 50);
      }
      await vendor.save();
    }

    // Set preferred vendors
    for (const item of items) {
      item.preferredVendor = vendors[Math.floor(Math.random() * vendors.length)]._id;
      await item.save();
    }

    // Create historical count data (12 weeks)
    console.log('Creating historical count data...');
    for (const item of items) {
      let currentStock = item.currentStock + Math.floor(Math.random() * 100);
      
      for (let week = 12; week >= 0; week--) {
        const countDate = new Date();
        countDate.setDate(countDate.getDate() - (week * 7));
        
        // Simulate consumption (higher in summer months)
        const month = countDate.getMonth();
        const isBusy = month >= 3 && month <= 9;
        const consumption = Math.floor(Math.random() * (isBusy ? 30 : 15)) + 5;
        
        await InventoryCount.create({
          item: item._id,
          count: currentStock,
          previousCount: currentStock + consumption,
          countedBy: user._id,
          countDate,
          source: 'manual',
          notes: week === 0 ? 'Current count' : 'Historical data'
        });
        
        currentStock = Math.max(0, currentStock - consumption);
        
        // Simulate occasional restocking
        if (currentStock < item.minimums.winter && Math.random() > 0.5) {
          currentStock += Math.floor(Math.random() * 50) + 30;
        }
      }
      
      // Update current stock to latest
      item.currentStock = (await InventoryCount.findOne({ item: item._id }).sort({ countDate: -1 })).count;
      await item.save();
    }

    // Calculate avg consumption for items
    console.log('Calculating consumption averages...');
    for (const item of items) {
      const consumption = await InventoryCount.calculateAvgConsumption(item._id);
      item.avgDailyConsumption = consumption.daily;
      item.avgWeeklyConsumption = consumption.weekly;
      await item.save();
    }

    // Create sample orders
    console.log('Creating sample orders...');
    const orderStatuses = ['delivered', 'delivered', 'delivered', 'shipped', 'confirmed', 'pending'];
    
    for (let i = 0; i < 10; i++) {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 60));
      
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];
      const status = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
      
      const orderItems = [];
      const numItems = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numItems; j++) {
        const item = items[Math.floor(Math.random() * items.length)];
        const price = vendor.getPriceForItem(item._id);
        orderItems.push({
          item: item._id,
          quantity: Math.floor(Math.random() * 30) + 10,
          unitPrice: price?.price || 5
        });
      }
      
      const expectedDelivery = new Date(orderDate);
      expectedDelivery.setDate(expectedDelivery.getDate() + vendor.metrics.avgLeadTime);
      
      const order = await Order.create({
        vendor: vendor._id,
        items: orderItems,
        status,
        orderDate,
        expectedDeliveryDate: expectedDelivery,
        actualDeliveryDate: status === 'delivered' ? expectedDelivery : undefined,
        placedBy: user._id
      });
      
      if (status === 'delivered') {
        order.leadTimeDays = vendor.metrics.avgLeadTime;
        await order.save();
      }
    }

    // Create sample alerts
    console.log('Creating sample alerts...');
    const lowStockItems = items.filter(i => i.currentStock < i.minimums.winter);
    for (const item of lowStockItems.slice(0, 3)) {
      await Alert.createLowStockAlert(item);
    }

    console.log('\n✅ Seed data created successfully!\n');
    console.log('Demo Login:');
    console.log('  Email: demo@lumberflow.com');
    console.log('  Password: Demo123!\n');
    console.log(`Created:`);
    console.log(`  - 1 User`);
    console.log(`  - ${vendors.length} Vendors`);
    console.log(`  - ${items.length} Inventory Items`);
    console.log(`  - ${await InventoryCount.countDocuments()} Count Records`);
    console.log(`  - ${await Order.countDocuments()} Orders`);
    console.log(`  - ${await Alert.countDocuments()} Alerts\n`);

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
