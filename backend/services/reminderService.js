/**
 * Reminder Service
 * 
 * Handles scheduled checks and email notifications for:
 * - Low stock warnings
 * - Reorder reminders (based on lead time)
 * - Delivery expectations
 * - Anomaly notifications
 */

const nodemailer = require('nodemailer');
const { InventoryItem, Order, Alert, User } = require('../models');
const forecastService = require('./forecastService');
const { logger } = require('../config/db');

// Email transporter
let transporter = null;

/**
 * Initialize email transporter
 */
const initializeTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    logger.info('Email transporter initialized');
  } else {
    logger.warn('Email not configured - notifications will be logged only');
  }
};

/**
 * Send email notification
 */
const sendEmail = async (to, subject, html, text) => {
  if (!transporter) {
    logger.info(`[EMAIL] To: ${to}, Subject: ${subject}`);
    logger.info(`[EMAIL] Content: ${text || html}`);
    return { sent: false, reason: 'Email not configured' };
  }
  
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject: `[LumberFlow] ${subject}`,
      text,
      html
    });
    
    return { sent: true };
  } catch (error) {
    logger.error('Email send error:', error);
    return { sent: false, error: error.message };
  }
};

/**
 * Build HTML email template
 */
const buildEmailTemplate = (title, content, items = []) => {
  const itemRows = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.value}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <span style="color: ${item.urgency === 'critical' ? '#dc2626' : item.urgency === 'high' ? '#f59e0b' : '#10b981'}">
          ${item.status}
        </span>
      </td>
    </tr>
  `).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e3a5f; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9fafb; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #e5e7eb; padding: 10px; text-align: left; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🪵 LumberFlow</h1>
        </div>
        <div class="content">
          <h2>${title}</h2>
          <p>${content}</p>
          ${items.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Details</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
            </table>
          ` : ''}
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="btn">View Dashboard</a>
          </p>
        </div>
        <div class="footer">
          <p>This is an automated message from LumberFlow Inventory System</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Check for low stock items and create alerts/send notifications
 */
const checkLowStock = async () => {
  logger.info('Running low stock check...');
  
  const items = await InventoryItem.find({ isActive: true });
  const lowStockItems = [];
  
  for (const item of items) {
    const minimum = item.currentMinimum;
    const stock = item.currentStock;
    
    if (stock < minimum) {
      let urgency = 'medium';
      if (stock <= 0) urgency = 'critical';
      else if (stock < minimum * 0.5) urgency = 'high';
      
      await Alert.createLowStockAlert(item);
      
      lowStockItems.push({
        name: item.displayName || item.name,
        value: `${stock} / ${minimum} units`,
        status: stock <= 0 ? 'OUT OF STOCK' : 'Low Stock',
        urgency
      });
    }
  }
  
  if (lowStockItems.length > 0) {
    const emailTo = process.env.ALERT_EMAIL;
    if (emailTo) {
      const html = buildEmailTemplate(
        'Low Stock Alert',
        `${lowStockItems.length} item(s) are below minimum stock levels and may need reordering.`,
        lowStockItems
      );
      
      await sendEmail(
        emailTo,
        `Low Stock Alert: ${lowStockItems.length} items need attention`,
        html,
        `${lowStockItems.length} items are below minimum stock levels.`
      );
    }
  }
  
  return {
    checked: items.length,
    lowStockCount: lowStockItems.length,
    items: lowStockItems
  };
};

/**
 * Check for items that need reordering based on lead time
 */
const checkReorderNeeds = async () => {
  logger.info('Running reorder check...');
  
  const recommendations = await forecastService.getReorderRecommendations();
  
  if (recommendations.length > 0) {
    const reorderItems = recommendations.map(rec => ({
      name: rec.item.name,
      value: `${rec.daysUntilStockout} days until stockout`,
      status: rec.urgency.toUpperCase(),
      urgency: rec.urgency
    }));
    
    // Create alerts
    for (const rec of recommendations) {
      const item = await InventoryItem.findById(rec.item.id);
      await Alert.createReorderReminder(item, rec.daysUntilStockout, rec.leadTime);
    }
    
    // Send email
    const emailTo = process.env.ALERT_EMAIL;
    if (emailTo) {
      const html = buildEmailTemplate(
        'Reorder Reminder',
        `${recommendations.length} item(s) should be reordered soon to avoid stockouts.`,
        reorderItems
      );
      
      await sendEmail(
        emailTo,
        `Reorder Reminder: ${recommendations.length} items`,
        html
      );
    }
  }
  
  return {
    recommendations: recommendations.length,
    items: recommendations
  };
};

/**
 * Check for expected deliveries
 */
const checkExpectedDeliveries = async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const pendingDeliveries = await Order.find({
    status: { $in: ['confirmed', 'shipped'] },
    expectedDeliveryDate: {
      $gte: today,
      $lte: tomorrow
    }
  }).populate('vendor', 'name').populate('items.item', 'name sku');
  
  if (pendingDeliveries.length > 0) {
    const deliveryItems = pendingDeliveries.map(order => ({
      name: `Order ${order.orderNumber}`,
      value: `From ${order.vendor?.name || 'Unknown'} - ${order.items.length} items`,
      status: order.expectedDeliveryDate.toDateString() === today.toDateString() ? 'TODAY' : 'TOMORROW',
      urgency: 'low'
    }));
    
    const emailTo = process.env.ALERT_EMAIL;
    if (emailTo) {
      const html = buildEmailTemplate(
        'Expected Deliveries',
        `${pendingDeliveries.length} delivery(ies) expected soon.`,
        deliveryItems
      );
      
      await sendEmail(
        emailTo,
        `Delivery Reminder: ${pendingDeliveries.length} expected`,
        html
      );
    }
  }
  
  return { expectedDeliveries: pendingDeliveries.length };
};

/**
 * Send daily summary
 */
const sendDailySummary = async () => {
  logger.info('Generating daily summary...');
  
  const lowStock = await checkLowStock();
  const reorder = await checkReorderNeeds();
  const deliveries = await checkExpectedDeliveries();
  
  // Get alert summary
  const activeAlerts = await Alert.find({ status: 'active' });
  const alertsByPriority = {
    critical: activeAlerts.filter(a => a.priority === 'critical').length,
    high: activeAlerts.filter(a => a.priority === 'high').length,
    medium: activeAlerts.filter(a => a.priority === 'medium').length,
    low: activeAlerts.filter(a => a.priority === 'low').length
  };
  
  const summaryItems = [
    { name: 'Low Stock Items', value: lowStock.lowStockCount.toString(), status: lowStock.lowStockCount > 0 ? 'NEEDS ATTENTION' : 'OK', urgency: lowStock.lowStockCount > 0 ? 'high' : 'low' },
    { name: 'Reorder Recommendations', value: reorder.recommendations.toString(), status: reorder.recommendations > 0 ? 'ACTION NEEDED' : 'OK', urgency: reorder.recommendations > 0 ? 'medium' : 'low' },
    { name: 'Expected Deliveries', value: deliveries.expectedDeliveries.toString(), status: deliveries.expectedDeliveries > 0 ? 'INCOMING' : 'NONE', urgency: 'low' },
    { name: 'Active Alerts', value: activeAlerts.length.toString(), status: alertsByPriority.critical > 0 ? 'CRITICAL' : 'NORMAL', urgency: alertsByPriority.critical > 0 ? 'critical' : 'low' }
  ];
  
  const emailTo = process.env.ALERT_EMAIL;
  if (emailTo) {
    const html = buildEmailTemplate(
      'Daily Inventory Summary',
      `Here's your daily inventory status update for ${new Date().toLocaleDateString()}.`,
      summaryItems
    );
    
    await sendEmail(
      emailTo,
      `Daily Summary - ${new Date().toLocaleDateString()}`,
      html
    );
  }
  
  return {
    lowStock,
    reorder,
    deliveries,
    alertsByPriority
  };
};

/**
 * Send notification for a specific alert
 */
const sendAlertNotification = async (alertId) => {
  const alert = await Alert.findById(alertId)
    .populate('item', 'name sku displayName');
  
  if (!alert || alert.emailSent) {
    return { sent: false, reason: 'Alert not found or already sent' };
  }
  
  const emailTo = process.env.ALERT_EMAIL;
  if (!emailTo) {
    return { sent: false, reason: 'No email configured' };
  }
  
  const html = buildEmailTemplate(
    alert.title,
    alert.message,
    [{
      name: alert.item?.displayName || alert.item?.name || 'Unknown Item',
      value: alert.message,
      status: alert.priority.toUpperCase(),
      urgency: alert.priority
    }]
  );
  
  const result = await sendEmail(emailTo, alert.title, html);
  
  if (result.sent) {
    alert.emailSent = true;
    alert.emailSentAt = new Date();
    await alert.save();
  }
  
  return result;
};

module.exports = {
  initializeTransporter,
  sendEmail,
  checkLowStock,
  checkReorderNeeds,
  checkExpectedDeliveries,
  sendDailySummary,
  sendAlertNotification
};
