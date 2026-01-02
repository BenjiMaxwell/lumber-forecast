const express = require('express');
const router = express.Router();
const {
  getForecast,
  getBatchForecasts,
  getReorderRecommendations,
  retrainModel,
  updateAllForecasts,
  getModelStatus
} = require('../controllers/forecastController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/batch', getBatchForecasts);
router.get('/reorder-recommendations', getReorderRecommendations);
router.get('/model-status', getModelStatus);
router.post('/retrain', authorize('admin', 'purchaser'), retrainModel);
router.post('/update-all', updateAllForecasts);
router.get('/:itemId', getForecast);

module.exports = router;
