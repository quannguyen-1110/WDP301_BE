const File = require("../models/File");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const Task = require("../models/Task");
const Chapter = require("../models/Chapter");
const Series = require("../models/Series");
const Assignment = require("../models/Assignment");
const { logAction } = require('../utils/auditLogger');

const canAccessFile = async (file, user) => {
  if (user.role === "ADMIN" || user.role === "BOARD_MEMBER" || file.uploadedBy?.toString() === user._id.toString()) {
    return true;
  }
  if (!file.chapterId) return false;
  if (user.role === "ASSISTANT") {
    // Assistant có thể truy cập nếu được giao task (Task) hoặc được mangaka mời (Assignment)
    return Boolean(await Task.exists({
      chapterId: file.chapterId,
      assignedTo: user._id,
    })) || Boolean(await Assignment.exists({
      chapterId: file.chapterId,
      assistantId: user._id,
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

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const fileUrl = req.file.path.startsWith('http')
      ? req.file.path
      : `/uploads/${req.file.filename}`;

    const newFile = await File.create({
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileUrl,

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
    if (req.query.chapterId) {
      filter.chapterId = req.query.chapterId;
    }
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
    } else if (req.user.role === "ASSISTANT") {
      const taskChapterIds = await Task.find({ assignedTo: req.user._id }).distinct("chapterId");
      const assignmentChapterIds = await Assignment.find({ assistantId: req.user._id }).distinct("chapterId");
      const chapterIds = [...new Set([...taskChapterIds, ...assignmentChapterIds])];
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

    if (file.fileUrl && file.fileUrl.startsWith('http')) {
      const response = await axios.get(file.fileUrl, {
        responseType: "stream",
      });
      res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName || file.fileName)}"`);
      return response.data.pipe(res);
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
