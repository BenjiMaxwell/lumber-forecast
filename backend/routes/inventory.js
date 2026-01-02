const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  recordCount,
  getCountHistory,
  importCSV,
  getSummary,
  bulkCount
} = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

// Multer config for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

router.use(protect);

router.route('/')
  .get(getItems)
  .post(createItem);

router.get('/summary', getSummary);
router.post('/import', upload.single('file'), importCSV);
router.post('/bulk-count', bulkCount);

router.route('/:id')
  .get(getItem)
  .put(updateItem)
  .delete(authorize('admin'), deleteItem);

router.post('/:id/count', recordCount);
router.get('/:id/history', getCountHistory);

module.exports = router;
