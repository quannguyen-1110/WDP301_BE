const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
} = require('../controllers/userController');

// Protect all routes
router.use(protect);

// ==================== ADMIN ROUTES ====================

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create new user (ADMIN only)
 *     tags: [Users]
 */
router.post('/', authorize('ADMIN'), createUser);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (ADMIN & EDITOR)
 */
router.get('/', authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA'), getUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 */
router.get('/:id', authorize('ADMIN', 'EDITOR'), getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user (ADMIN only)
 */
router.put('/:id', authorize('ADMIN'), updateUser);

/**
 * @swagger
 * /api/users/{id}/status:
 *   put:
 *     summary: Activate/Deactivate user (ADMIN only)
 */
router.put('/:id/status', authorize('ADMIN'), toggleUserStatus);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Soft delete user (ADMIN only)
 */
router.delete('/:id', authorize('ADMIN'), deleteUser);

module.exports = router;