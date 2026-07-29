const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

const {
  createDefenseReport,
  getDefenseReports,
  getDefenseReportById,
  updateDefenseReport,
  submitDefenseReport,
  reviewDefenseReport,
} = require('../controllers/defenseReportController');

// Protect all routes
router.use(protect);

/**
 * Create defense report
 */
router.post('/', authorize('ADMIN', 'EDITOR'), createDefenseReport);

/**
 * Get defense reports
 */
router.get('/', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER'), getDefenseReports);

/**
 * Get by ID
 */
router.get('/:id', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER'), getDefenseReportById);

/**
 * Update report
 */
router.put('/:id', authorize('ADMIN', 'EDITOR'), updateDefenseReport);

/**
 * Submit report
 */
router.post('/:id/submit', authorize('ADMIN', 'EDITOR'), submitDefenseReport);

/**
 * Review report
 */
router.post('/:id/review', authorize('ADMIN', 'BOARD_MEMBER'), reviewDefenseReport);

module.exports = router;