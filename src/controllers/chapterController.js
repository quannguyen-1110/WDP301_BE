const Chapter = require("../models/Chapter.js");
const { logAction } = require('../utils/auditLogger');

const CHAPTER_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
};

exports.getAllChapters = async (req, res) => {
  try {
    const { seriesId } = req.query;

    const filter = {};
    if (seriesId) filter.seriesId = seriesId;

    const chapters = await Chapter.find(filter)
      .populate("seriesId", "title")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: chapters.length,
      data: chapters,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE CHAPTER
exports.createChapter = async (req, res) => {
  try {
    const { seriesId, chapterNumber, title } = req.body;

    if (req.body.deadline) {
      req.body.dueAt = req.body.deadline;
    }

    const chapter = await Chapter.create(req.body);

    // ==================== AUDIT LOG ====================
    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Created Chapter",
      `Chapter ${chapterNumber} - ${title || 'Untitled'}`,
      `Series ID: ${seriesId}`
    );

    if (req.io) {
      req.io.emit("chapter_created", chapter);
    }

    res.status(201).json({
      success: true,
      message: "Chapter created successfully",
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET CHAPTERS BY SERIES
exports.getChapterBySeriesId = async (seriesId) => {
  return await Chapter.find({ seriesId }).sort({ createdAt: 1 });
};

// UPDATE CHAPTER
exports.updateChapter = async (req, res) => {
  try {
    if (req.body.deadline) {
      req.body.dueAt = req.body.deadline;
    }

    const chapter = await Chapter.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!chapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Updated Chapter",
      `Chapter ID: ${req.params.id}`,
      `New status: ${chapter.status}`
    );

    if (req.io) {
      req.io.emit("chapter_updated", chapter);
    }

    res.status(200).json({
      success: true,
      message: "Chapter updated successfully",
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE CHAPTER
exports.deleteChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndDelete(req.params.id);

    if (!chapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Deleted Chapter",
      `Chapter ID: ${req.params.id}`,
      `Series ID: ${chapter.seriesId}`
    );

    if (req.io) {
      req.io.emit("chapter_deleted", { id: req.params.id });
    }

    res.status(200).json({
      success: true,
      message: "Chapter deleted successfully",
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUBLISH CHAPTER
exports.publishChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndUpdate(
      req.params.id,
      {
        status: CHAPTER_STATUS.COMPLETED,
        publishedAt: new Date(),
      },
      { new: true }
    );

    if (!chapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Published Chapter",
      `Chapter ID: ${req.params.id}`,
      `Series ID: ${chapter.seriesId}`
    );

    if (req.io) {
      req.io.emit("chapter_published", chapter);
    }

    res.status(200).json({
      success: true,
      message: "Chapter published successfully",
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};