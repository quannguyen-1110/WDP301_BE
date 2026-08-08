const Chapter = require("../models/Chapter.js");
const Page = require("../models/Page.js");
const Task = require("../models/Task.js");
const Series = require("../models/Series.js");
const Annotation = require("../models/Annotation.js");
const Notification = require("../models/Notification.js");
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
    const { seriesId, chapterNumber, title, deadline, dueAt } = req.body;

    if (!seriesId || !Number.isInteger(Number(chapterNumber)) || Number(chapterNumber) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Series and a positive chapter number are required",
      });
    }

    if (!(await canManageSeries(req.user, seriesId))) {
      return res.status(403).json({
        success: false,
        message: "You can only create chapters for a series you manage",
      });
    }

    const parsedDueAt = new Date(deadline || dueAt);
    if (Number.isNaN(parsedDueAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "A valid chapter deadline is required",
      });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(parsedDueAt);
    if (dueDay < today) {
      return res.status(400).json({
        success: false,
        message: "Chapter deadline cannot be in the past",
      });
    }

    if (await Chapter.exists({ seriesId, chapterNumber: Number(chapterNumber) })) {
      return res.status(409).json({
        success: false,
        message: `Chapter ${chapterNumber} already exists in this series`,
      });
    }

    const chapter = await Chapter.create({
      seriesId,
      chapterNumber: Number(chapterNumber),
      title: title?.trim(),
      dueAt: parsedDueAt,
      createdBy: req.user._id,
      status: "IN_PROGRESS",
    });

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
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This chapter number already exists in the series",
      });
    }
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
    const existingChapter = await Chapter.findById(req.params.id).select("seriesId status");
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
      if (!['EDITOR', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Only the assigned Tantou Editor can complete final chapter review",
        });
      }

      const tasks = await Task.find({ chapterId: req.params.id }).select("status");
      if (tasks.length === 0 || tasks.some((task) => task.status !== "APPROVED")) {
        return res.status(400).json({
          success: false,
          message: "Every chapter task must receive final Editor approval first",
        });
      }
    }

    const requestedUpdates = { ...req.body };
    if (requestedUpdates.deadline !== undefined && requestedUpdates.dueAt === undefined) {
      requestedUpdates.dueAt = requestedUpdates.deadline;
    }

    const allowedUpdates = ['chapterNumber', 'title', 'dueAt', 'status', 'totalPages'];
    const updatePayload = Object.fromEntries(
      Object.entries(requestedUpdates).filter(([key]) => allowedUpdates.includes(key))
    );

    if (updatePayload.chapterNumber !== undefined) {
      const chapterNumber = Number(updatePayload.chapterNumber);
      if (!Number.isInteger(chapterNumber) || chapterNumber <= 0) {
        return res.status(400).json({ success: false, message: "Invalid chapter number" });
      }
      const duplicateChapter = await Chapter.exists({
        _id: { $ne: req.params.id },
        seriesId: existingChapter.seriesId,
        chapterNumber,
      });
      if (duplicateChapter) {
        return res.status(409).json({
          success: false,
          message: `Chapter ${chapterNumber} already exists in this series`,
        });
      }
      updatePayload.chapterNumber = chapterNumber;
    }

    if (updatePayload.dueAt !== undefined) {
      const parsedDueAt = new Date(updatePayload.dueAt);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(parsedDueAt.getTime()) || parsedDueAt < today) {
        return res.status(400).json({
          success: false,
          message: "Chapter deadline must be a valid current or future date",
        });
      }
      updatePayload.dueAt = parsedDueAt;
    }

    const chapter = await Chapter.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    if (!chapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    // ===== Chapter Revision Notification =====
    // When an editor requests a revision for a chapter, notify the mangaka
    // (and any assigned assistants) with a deep-link to the chapter workspace.
    if (req.body.status === 'REVISION_REQUESTED') {
      const series = await Series.findById(chapter.seriesId).select('title mangakaId editorId');
      const recipients = [series?.mangakaId, series?.editorId].filter(Boolean);
      const uniqueRecipients = [...new Set(recipients.map((id) => id.toString()))];

      const notifications = await Notification.insertMany(
        uniqueRecipients.map((userId) => ({
          userId,
          title: 'Chapter Revision Requested',
          content: `Editor requested revision for Chapter ${chapter.chapterNumber} of "${series?.title || 'Series'}". Please review the annotations and revise.`,
          type: 'WARNING',
          link: `/editor/review/${chapter.seriesId}`,
          targetType: 'CHAPTER',
          targetId: chapter._id,
        })),
      );
      if (req.io) {
        notifications.forEach((notification) => {
          req.io.to(notification.userId.toString()).emit('notification', notification);
        });
      }
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

// @desc    Mangaka submits a page image directly to the editor (no task needed)
// @route   POST /api/chapters/:id/submit-page
// @access  MANGAKA, ADMIN
exports.submitPageToEditor = async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }
    if (!(await canManageSeries(req.user, chapter.seriesId))) {
      return res.status(403).json({
        success: false,
        message: "You can only submit pages for a series you manage",
      });
    }

    const { imageUrl, note } = req.body;
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: "imageUrl is required — upload the page image first",
      });
    }

    const latestPage = await Page.findOne({ chapterId: chapter._id }).sort({ pageNumber: -1 });
    const page = await Page.create({
      chapterId: chapter._id,
      pageNumber: (latestPage?.pageNumber || 0) + 1,
      imageUrl,
      status: "COMPLETED",
      note: note || "",
    });

    const annotations = [];

    if (chapter.status === "IN_PROGRESS" || chapter.status === "COMPLETED") {
      chapter.status = "SUBMITTED";
    }
    chapter.totalPages = await Page.countDocuments({ chapterId: chapter._id });
    await chapter.save();

    // Notify the assigned editor.
    const series = await Series.findById(chapter.seriesId).select("title editorId mangakaId");
    if (series?.editorId) {
      const notification = await Notification.create({
        userId: series.editorId,
        title: "Chapter Submitted for Review",
        content: `${series.title} — Chapter ${chapter.chapterNumber} was submitted by the Mangaka.`,
        type: "INFO",
        link: `/editor/review/${chapter.seriesId}`,
        targetType: "CHAPTER",
        targetId: chapter._id,
      });
      if (req.io) {
        req.io.to(series.editorId.toString()).emit("notification", notification);
      }
    }

    // ==================== AUDIT LOG ====================
    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Submitted Page to Editor",
      `Page ${page.pageNumber} - Chapter ${chapter.chapterNumber}`,
      `Chapter ID: ${chapter._id}`
    );

    res.status(201).json({
      success: true,
      message: "Page submitted to the editor for review",
      data: { page, annotations, chapter },
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
