const express = require('express');
const router = express.Router();
const { getUsers } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users with optional role filtering
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [MANGAKA, ASSISTANT, EDITOR, BOARD_MEMBER]
 *         description: Filter users by role (e.g. ASSISTANT)
 *     responses:
 *       200:
 *         description: Return list of users
 *       403:
 *         description: Forbidden - Only EDITOR and MANGAKA are authorized
 */
router.get('/', authorize('EDITOR', 'MANGAKA'), getUsers);

module.exports = router;
