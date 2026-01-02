const express = require('express');
const router = express.Router();
const {
  getAlerts,
  getAlertSummary,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  getAnomalies,
  runAnomalyDetection,
  triggerCheck
} = require('../controllers/alertController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getAlerts);
router.get('/summary', getAlertSummary);
router.get('/anomalies', getAnomalies);
router.post('/run-detection', runAnomalyDetection);
router.post('/check', triggerCheck);

router.put('/:id/acknowledge', acknowledgeAlert);
router.put('/:id/resolve', resolveAlert);
router.put('/:id/dismiss', dismissAlert);

module.exports = router;
