const express = require("express");
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.js');
const upload = require("../middleware/cloudinaryUpload");
const File = require("../models/File");
const Chapter = require("../models/Chapter");
const Series = require("../models/Series");
const Task = require("../models/Task");
const Assignment = require("../models/Assignment");
const fs = require("fs");
const {
  downloadFile,
  getAllFiles,
  getFile,
} = require("../controllers/fileController");

router.use(protect);

/**
 * Upload file (Chỉ ADMIN + MANGAKA + ASSISTANT)
 * Editor & Board chỉ xem, không upload.
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

      if (req.body.chapterId) {
        const chapter = await Chapter.findById(req.body.chapterId).select("seriesId");
        let allowed = Boolean(chapter);
        if (allowed && req.user.role === "MANGAKA") {
          allowed = Boolean(await Series.exists({
            _id: chapter.seriesId,
            mangakaId: req.user._id,
          }));
        }
        if (allowed && req.user.role === "ASSISTANT") {
          // Assistant được phép upload nếu được giao task (Task) hoặc được mangaka mời (Assignment)
          allowed = Boolean(await Task.exists({
            chapterId: chapter._id,
            assignedTo: req.user._id,
          })) || Boolean(await Assignment.exists({
            chapterId: chapter._id,
            assistantId: req.user._id,
          }));
        }
        if (!allowed) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(403).json({
            success: false,
            message: "You cannot upload files to this chapter",
          });
        }
      }

      const fileUrl = req.file.path.startsWith('http')
        ? req.file.path
        : `/uploads/${req.file.filename}`;

      const newFile = await File.create({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileUrl,
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

// Xem danh sách file (tất cả roles - view only)
router.get("/", authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA', 'ASSISTANT'), getAllFiles);

/**
 * Download file (Chỉ ADMIN + MANGAKA + ASSISTANT)
 * Editor & Board chỉ xem nội dung trên web, không download.
 */
router.get(
  "/download/:id",
  authorize('ADMIN', 'MANGAKA', 'ASSISTANT'),
  downloadFile,
);

/**
 * Get file detail (xem - tất cả roles)
 */
router.get("/:id", authorize('ADMIN', 'EDITOR', 'BOARD_MEMBER', 'MANGAKA', 'ASSISTANT'), getFile);

module.exports = router;
