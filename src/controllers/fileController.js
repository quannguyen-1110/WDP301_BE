const File = require("../models/File");
const fs = require("fs");
const Task = require("../models/Task");
const Chapter = require("../models/Chapter");
const Series = require("../models/Series");

const canAccessFile = async (file, user) => {
  if (user.role === "ADMIN" || file.uploadedBy?.toString() === user._id.toString()) {
    return true;
  }
  if (!file.chapterId) return false;
  if (user.role === "ASSISTANT") {
    return Boolean(await Task.exists({
      chapterId: file.chapterId,
      assignedTo: user._id,
    }));
  }
  const chapter = await Chapter.findById(file.chapterId).select("seriesId");
  if (!chapter) return false;
  if (user.role === "MANGAKA") {
    return Boolean(await Series.exists({
      _id: chapter.seriesId,
      mangakaId: user._id,
    }));
  }
  if (user.role === "EDITOR") {
    return Boolean(await Series.exists({
      _id: chapter.seriesId,
      editorId: user._id,
    }));
  }
  return false;
};
const path = require("path");
const { logAction } = require('../utils/auditLogger');

exports.uploadFile = async (req, res) => {
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

      uploadedBy: req.user?._id,
      roleUploaded: req.user?.role,

      chapterId: req.body.chapterId || null,
    });

    // ==================== AUDIT LOG ====================
    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Uploaded File",
      `File: ${req.file.originalname}`,
      `Chapter ID: ${req.body.chapterId || 'N/A'}`
    );

    if (req.io) {
      req.io.emit("file_uploaded", {
        fileName: newFile.originalName,
        uploadedBy: req.user?.name,
      });
    }

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
};

exports.getAllFiles = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === "MANGAKA" || req.user.role === "EDITOR") {
      const seriesFilter = req.user.role === "MANGAKA"
        ? { mangakaId: req.user._id }
        : { editorId: req.user._id };
      const seriesIds = await Series.find(seriesFilter).distinct("_id");
      const chapterIds = await Chapter.find({ seriesId: { $in: seriesIds } }).distinct("_id");
      filter.$or = [
        { uploadedBy: req.user._id },
        { chapterId: { $in: chapterIds } },
      ];
    }

    const files = await File.find(filter)
      .populate("uploadedBy", "name email role")
      .populate("chapterId");

    res.status(200).json({
      success: true,
      count: files.length,
      data: files,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFile = async (req, res) => {
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

    if (!(await canAccessFile(file, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this file",
      });
    }

    res.status(200).json({
      success: true,
      data: file,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    if (!(await canAccessFile(file, req.user))) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this file",
      });
    }

    const filePath = path.join(process.cwd(), "src", "uploads", file.fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File content not found on server",
      });
    }

    return res.download(filePath, file.originalName);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};