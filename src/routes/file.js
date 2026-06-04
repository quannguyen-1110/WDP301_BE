const express = require("express");
const upload = require("../middleware/upload");
const File = require("../models/File");

const router = express.Router();

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Upload a file
 *     tags:
 *       - Files
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Upload successful
 */
router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      const newFile = await File.create({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileUrl: req.file.path,
      });

      res.status(201).json({
        success: true,
        data: newFile,
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Get all files
 *     tags:
 *       - Files
 *     responses:
 *       200:
 *         description: List all files
 */
router.get("/", async (req, res) => {
  try {
    const files = await File.find();

    res.json({
      success: true,
      count: files.length,
      data: files,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/files/{id}:
 *   get:
 *     summary: View file detail
 *     tags:
 *       - Files
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File detail
 */
router.get("/:id", async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    res.json({
      success: true,
      data: file,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @swagger
 * /api/files/download/{id}:
 *   get:
 *     summary: Download file
 *     tags:
 *       - Files
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Download file
 */
router.get("/download/:id", async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    res.download(file.fileUrl);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;