require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { connectDB, logger } = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { reminderService, forecastService, anomalyService } = require('./services');

// Import routes
const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const orderRoutes = require('./routes/orders');
const vendorRoutes = require('./routes/vendors');
const forecastRoutes = require('./routes/forecasts');
const alertRoutes = require('./routes/alerts');

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/forecasts', forecastRoutes);
app.use('/api/alerts', alertRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Connect to database and start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
    // Initialize email transporter
    reminderService.initializeTransporter();
    
    // Train model on startup if enough data
    logger.info('Attempting initial model training...');
    try {
      await forecastService.trainGlobalModel();
    } catch (err) {
      logger.warn('Initial model training skipped (not enough data)');
    }
    
    // Schedule cron jobs
    setupCronJobs();
    
    app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Setup scheduled tasks
const setupCronJobs = () => {
  // Daily low stock check - every day at 7 AM
  cron.schedule('0 7 * * *', async () => {
    logger.info('Running daily low stock check...');
    await reminderService.checkLowStock();
  });
  
  // Daily reorder check - every day at 8 AM
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running daily reorder check...');
    await reminderService.checkReorderNeeds();
  });
  
  // Delivery reminder - every day at 6 AM
  cron.schedule('0 6 * * *', async () => {
    logger.info('Checking expected deliveries...');
    await reminderService.checkExpectedDeliveries();
  });
  
  // Daily summary - every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Sending daily summary...');
    await reminderService.sendDailySummary();
  });
  
  // Anomaly detection - every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running anomaly detection...');
    await anomalyService.runBatchAnalysis(6);
  });
  
  // Weekly model retraining - Sunday at midnight
  const retrainSchedule = process.env.MODEL_RETRAIN_SCHEDULE || '0 0 * * 0';
  cron.schedule(retrainSchedule, async () => {
    logger.info('Retraining forecast model...');
    await forecastService.trainGlobalModel();
    await forecastService.updateItemForecasts();
  });
  
  logger.info('Cron jobs scheduled');
};

startServer();

module.exports = app;
