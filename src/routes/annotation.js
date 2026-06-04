const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth.js');
const {
  createAnnotation,
  getAnnotationsByPage,
  updateAnnotation,
  deleteAnnotation,
} = require('../controllers/annotationController.js');

/**
 * @swagger
 * /api/annotations:
 *   post:
 *     summary: Create a new annotation on a page (Editor or Mangaka)
 *     tags: [Annotations]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pageId
 *               - coords
 *               - content
 *               - type
 *             properties:
 *               pageId:
 *                 type: string
 *                 example: 665abc123...
 *               coords:
 *                 type: object
 *                 example: { x: 100, y: 150, width: 50, height: 50 }
 *               content:
 *                 type: string
 *                 example: Correct the script text here
 *               type:
 *                 type: string
 *                 enum: [CONTENT, SCRIPT, DIALOGUE]
 *                 example: SCRIPT
 *     responses:
 *       201:
 *         description: Annotation created successfully
 *       404:
 *         description: Page not found
 */
router.post('/', authorize('EDITOR', 'MANGAKA'), createAnnotation);

/**
 * @swagger
 * /api/annotations/page/{pageId}:
 *   get:
 *     summary: Get all annotations for a specific page
 *     tags: [Annotations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of annotations returned successfully
 */
router.get('/page/:pageId', authorize('EDITOR', 'MANGAKA', 'ASSISTANT'), getAnnotationsByPage);

/**
 * @swagger
 * /api/annotations/{id}:
 *   put:
 *     summary: Update an annotation
 *     tags: [Annotations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coords:
 *                 type: object
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [CONTENT, SCRIPT, DIALOGUE]
 *     responses:
 *       200:
 *         description: Annotation updated successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Annotation not found
 */
router.put('/:id', authorize('EDITOR', 'MANGAKA'), updateAnnotation);

/**
 * @swagger
 * /api/annotations/{id}:
 *   delete:
 *     summary: Delete an annotation
 *     tags: [Annotations]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Annotation deleted successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Annotation not found
 */
router.delete('/:id', authorize('EDITOR', 'MANGAKA'), deleteAnnotation);

module.exports = router;
