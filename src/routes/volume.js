const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');

const {
  getAllVolumes,
  createVolume,
  getVolumeById,
  updateVolume,
  deleteVolume,
} = require('../controllers/volumeController.js');

// Protect all routes
router.use(protect);

/**
 * Get all volumes (xem - tất cả roles)
 */
router.get('/', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA', 'ASSISTANT'), getAllVolumes);

/**
 * Get volume by id (xem)
 */
router.get('/:id', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA', 'ASSISTANT'), getVolumeById);

/**
 * Create volume (chỉ MANGAKA + ADMIN)
 */
router.post('/', authorize('ADMIN', 'MANGAKA'), createVolume);

/**
 * Update volume (MANGAKA + EDITOR + ADMIN)
 */
router.put('/:id', authorize('ADMIN', 'MANGAKA', 'EDITOR'), updateVolume);

/**
 * Delete volume (MANGAKA + ADMIN)
 */
router.delete('/:id', authorize('ADMIN', 'MANGAKA'), deleteVolume);

module.exports = router;
