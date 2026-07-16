const Chapter = require("../models/Chapter.js");
const Page = require("../models/Page.js");
const Task = require("../models/Task.js");
const Series = require("../models/Series.js");
const Annotation = require("../models/Annotation.js");
const { logAction } = require('../utils/auditLogger');

const CHAPTER_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
};

const canManageSeries = async (user, seriesId) => {
  if (user.role === "ADMIN") return true;
  if (user.role === "MANGAKA") {
    return Boolean(await Series.exists({ _id: seriesId, mangakaId: user._id }));
  }
  if (user.role === "EDITOR") {
    return Boolean(await Series.exists({ _id: seriesId, editorId: user._id }));
  }
  return false;
};

const getPagesWithAnnotations = async (chapterId) => {
  const pages = await Page.find({ chapterId }).sort({ pageNumber: 1 });
  return Promise.all(
    pages.map(async (page) => ({
      ...page.toObject(),
      annotations: await Annotation.find({ pageId: page._id })
        .populate("annotatorId", "name role")
        .sort({ createdAt: 1 }),
    })),
  );
};

exports.getAllChapters = async (req, res) => {
  try {
    const { seriesId } = req.query;

    const filter = {};
    if (seriesId) filter.seriesId = seriesId;

    if (req.user.role === "MANGAKA" || req.user.role === "EDITOR") {
      const seriesFilter = req.user.role === "MANGAKA"
        ? { mangakaId: req.user._id }
        : { editorId: req.user._id };
      const allowedSeriesIds = await Series.find(seriesFilter).distinct("_id");
      if (seriesId && !allowedSeriesIds.some((id) => id.toString() === seriesId)) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      if (!seriesId) filter.seriesId = { $in: allowedSeriesIds };
    }
    if (req.user.role === "ASSISTANT") {
      const allowedChapterIds = await Task.find({ assignedTo: req.user._id })
        .distinct("chapterId");
      filter._id = { $in: allowedChapterIds };
    }

    const chapters = await Chapter.find(filter)
      .populate("seriesId", "title")
      .sort({ createdAt: 1 });
    const chapterData = await Promise.all(
      chapters.map(async (chapter) => ({
        ...chapter.toObject(),
        pages: await getPagesWithAnnotations(chapter._id),
      })),
    );

    res.status(200).json({
      success: true,
      count: chapterData.length,
      data: chapterData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE CHAPTER
exports.createChapter = async (req, res) => {
  try {
    const { seriesId, chapterNumber, title } = req.body;

    if (!(await canManageSeries(req.user, seriesId))) {
      return res.status(403).json({
        success: false,
        message: "You can only create chapters for a series you manage",
      });
    }

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

// GET CHAPTER BY ID
exports.getChapterById = async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.id).populate("seriesId", "title");
    if (!chapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    if (req.user.role === "MANGAKA" || req.user.role === "EDITOR") {
      const seriesId = chapter.seriesId?._id || chapter.seriesId;
      const seriesFilter = req.user.role === "MANGAKA"
        ? { _id: seriesId, mangakaId: req.user._id }
        : { _id: seriesId, editorId: req.user._id };
      if (!(await Series.exists(seriesFilter))) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this chapter",
        });
      }
    }
    if (
      req.user.role === "ASSISTANT" &&
      !(await Task.exists({ chapterId: chapter._id, assignedTo: req.user._id }))
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this chapter",
      });
    }

    const pages = await getPagesWithAnnotations(chapter._id);
    return res.status(200).json({
      success: true,
      data: {
        ...chapter.toObject(),
        pages,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE CHAPTER
exports.updateChapter = async (req, res) => {
  try {
    const existingChapter = await Chapter.findById(req.params.id).select("seriesId");
    if (!existingChapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }
    if (!(await canManageSeries(req.user, existingChapter.seriesId))) {
      return res.status(403).json({
        success: false,
        message: "You can only update chapters for a series you manage",
      });
    }

    if (req.body.status === 'PUBLISHED' || req.body.publishedAt !== undefined) {
      return res.status(409).json({
        success: false,
        message: 'Publishing fields are controlled by Editorial Board approval',
      });
    }

    if (req.body.deadline) {
      req.body.dueAt = req.body.deadline;
    }

    if (req.body.status === "SENT_TO_EDITORIAL") {
      const tasks = await Task.find({ chapterId: req.params.id }).select("status");
      if (tasks.length === 0) {
        return res.status(400).json({
          success: false,
          message: "A chapter must have tasks before editorial approval",
        });
      }
      if (tasks.some((task) => task.status !== "APPROVED")) {
        return res.status(400).json({
          success: false,
          message: "All tasks require final editor approval first",
        });
      }
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
    const existingChapter = await Chapter.findById(req.params.id).select("seriesId");
    if (!existingChapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }
    if (!(await canManageSeries(req.user, existingChapter.seriesId))) {
      return res.status(403).json({
        success: false,
        message: "You can only delete chapters for a series you manage",
      });
    }

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

// Publication is finalized by an approved Editorial Board session.
exports.publishChapter = async (req, res) => res.status(409).json({
  success: false,
  message: 'Direct publishing is disabled. Use the Editorial Board publication review flow.',
});
