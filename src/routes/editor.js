const express = require('express');
const router = express.Router();

const {
  getMySeries,
  getSeriesStats,
  getSeriesProgress,
  getDashboard,
  getTaskStatistics,
  getOverdueTasks,
  getProductionOverview,
} = require('../controllers/editorController.js');

/**
 * @swagger
 * /api/editor/my-series:
 *   get:
 *     summary: Get all series managed by this Tantou Editor
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 */
router.get('/my-series', getMySeries);

/**
 * @swagger
 * /api/editor/series/{seriesId}/stats:
 *   get:
 *     summary: Get metrics & numbers of a series to defend before the editorial board
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 */
router.get('/series/:seriesId/stats', getSeriesStats);

/**
 * @swagger
 * /api/editor/series/{seriesId}/progress:
 *   get:
 *     summary: Monitor real-time production progress of a studio/mangaka
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 */
router.get('/series/:seriesId/progress', getSeriesProgress);

/**
 * @swagger
 * /api/editor/series/{seriesId}/tasks/statistics:
 *   get:
 *     summary: Get task statistics of a series
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/series/:seriesId/tasks/statistics',
  getTaskStatistics
);

/**
 * @swagger
 * /api/editor/series/{seriesId}/overdue-tasks:
 *   get:
 *     summary: Get overdue tasks of a series
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/series/:seriesId/overdue-tasks',
  getOverdueTasks
);

/**
 * @swagger
 * /api/editor/dashboard:
 *   get:
 *     summary: Editor dashboard overview
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /api/editor/dashboard/production-overview:
 *   get:
 *     summary: Production overview dashboard
 *     tags: [Editor]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  '/dashboard/production-overview',
  getProductionOverview
);

module.exports = router;