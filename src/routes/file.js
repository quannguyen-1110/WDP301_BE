const express = require("express");
const path = require("path");
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
 *     security:
 *       - BearerAuth: []
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
 *               chapterId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Upload successful
 */
router.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      // Chỉ MANGAKA và ASSISTANT được upload
      if (
        req.user.role !== "MANGAKA" &&
        req.user.role !== "ASSISTANT"
      ) {
        return res.status(403).json({
          success: false,
          message: "Only Mangaka and Assistant can upload files",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const newFile = await File.create({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,

        uploadedBy: req.user._id,
        roleUploaded: req.user.role,

        chapterId: req.body.chapterId || null,
      });

      // Socket realtime
      if (req.io) {
        req.io.emit("file_uploaded", {
          fileId: newFile._id,
          fileName: newFile.originalName,
          uploadedBy: req.user.name,
        });
      }

      res.status(201).json({
        success: true,
        message: "File uploaded successfully",
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
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List all files
 */
router.get("/", async (req, res) => {
  try {

    const files = await File.find()
      .populate("uploadedBy", "name email role")
      .populate("chapterId");

    res.status(200).json({
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
 * /api/files/download/{id}:
 *   get:
 *     summary: Download file
 *     tags:
 *       - Files
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
 *         description: Download successful
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

    res.download(path.resolve(file.fileUrl));

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
 *         description: File detail
 */
router.get("/:id", async (req, res) => {
  try {

    const file = await File.findById(req.params.id)
      .populate("uploadedBy", "name email role")
      .populate("chapterId");

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    res.status(200).json({
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

module.exports = router;