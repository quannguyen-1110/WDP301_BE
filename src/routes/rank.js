const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');
const { 
  getSeriesRanks, 
  submitRank, 
  updateRank, 
  deleteRank 
} = require('../controllers/rankController.js');

// Protect all routes
router.use(protect);

/**
 * Submit rank (ADMIN + BOARD_MEMBER)
 */
router.post('/', authorize('ADMIN', 'BOARD_MEMBER'), submitRank);

/**
 * Get ranks
 */
router.get('/:seriesId', authorize('ADMIN', 'BOARD_MEMBER', 'EDITOR', 'MANGAKA'), getSeriesRanks);

/**
 * Update rank
 */
router.put('/:id', authorize('ADMIN', 'BOARD_MEMBER'), updateRank);

/**
 * Delete rank
 */
router.delete('/:id', authorize('ADMIN', 'BOARD_MEMBER'), deleteRank);

module.exports = router;