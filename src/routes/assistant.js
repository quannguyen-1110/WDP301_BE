const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');

const {
  getMyTasks,
  getTaskPages,
  uploadPageResult,
  submitTask,
  getEarnings,
  getEarningDetail,
  getStats,
  getIncomeTasks,
  getIncomeAnalytics,
  getPayoutAccount,
} = require('../controllers/assistantController.js');

// Protect all routes
router.use(protect);

// Assistant routes (ADMIN cũng xem được để hỗ trợ)
router.use(authorize('ADMIN', 'ASSISTANT'));

/**
 * Get my tasks
 */
router.get('/my-tasks', getMyTasks);

/**
 * Get task pages
 */
router.get('/tasks/:taskId/pages', getTaskPages);

/**
 * Upload page result
 */
router.put('/pages/:pageId/upload', uploadPageResult);

/**
 * Submit task
 */
router.put('/tasks/:taskId/submit', submitTask);

/**
 * Get earnings
 */
router.get('/earnings', getEarnings);

/**
 * Get earning detail by month
 */
router.get('/earnings/:month', getEarningDetail);

/**
 * Get stats
 */
router.get('/stats', getStats);

router.get('/income/tasks', getIncomeTasks);
router.get('/income/analytics', getIncomeAnalytics);
router.get('/payout-account', getPayoutAccount);

module.exports = router;