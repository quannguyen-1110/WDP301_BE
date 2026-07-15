const express = require("express");
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');
const upload = require("../middleware/cloudinaryUpload");
const File = require("../models/File");

router.use(protect);

/**
 * Upload file (ADMIN + MANGAKA + ASSISTANT)
 */
router.post(
  "/upload",
  authorize('ADMIN', 'MANGAKA', 'ASSISTANT'),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const newFile = await File.create({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileUrl: req.file.path,
        cloudinaryPublicId: req.file.filename,
        uploadedBy: req.user._id,
        roleUploaded: req.user.role,
        chapterId: req.body.chapterId || null,
      });

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
 * Get all files (ADMIN + EDITOR + MANGAKA)
 */
router.get("/", authorize('ADMIN', 'EDITOR', 'MANGAKA'), async (req, res) => {
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
 * Download file
 */
router.get("/download/:id", authorize('ADMIN', 'MANGAKA', 'ASSISTANT', 'EDITOR'), async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    res.download(file.fileUrl);   // Sửa path nếu cần
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get file detail
 */
router.get("/:id", authorize('ADMIN', 'EDITOR', 'MANGAKA'), async (req, res) => {
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