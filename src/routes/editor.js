const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getMySeries,
  getSeriesStats,
  getSeriesProgress,
  getDashboard,
  getTaskStatistics,
  getOverdueTasks,
  getProductionOverview,
} = require('../controllers/editorController.js');

// Protect all routes
router.use(protect);

// ADMIN + EDITOR đều được truy cập
router.get('/my-series', authorize('ADMIN', 'EDITOR'), getMySeries);

router.get('/series/:seriesId/stats', authorize('ADMIN', 'EDITOR'), getSeriesStats);

router.get('/series/:seriesId/progress', authorize('ADMIN', 'EDITOR'), getSeriesProgress);

router.get('/series/:seriesId/tasks/statistics', authorize('ADMIN', 'EDITOR'), getTaskStatistics);

router.get('/series/:seriesId/overdue-tasks', authorize('ADMIN', 'EDITOR'), getOverdueTasks);

router.get('/dashboard', authorize('ADMIN', 'EDITOR'), getDashboard);

router.get('/dashboard/production-overview', authorize('ADMIN', 'EDITOR'), getProductionOverview);

module.exports = router;