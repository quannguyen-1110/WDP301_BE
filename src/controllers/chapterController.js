const Chapter = require("../models/Chapter.js");

const CHAPTER_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
};

exports.getAllChapters = async (req, res) => {
  try {
    const { seriesId } = req.query;
    const filter = {};
    if (seriesId) filter.seriesId = seriesId;

    const chapters = await Chapter.find(filter)
      .populate('seriesId', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: chapters.length,
      data: chapters,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// CREATE CHAPTER
exports.createChapter = async (req, res) => {
  try {
    const { seriesId, title, chapterNumber } = req.body;

    if (!seriesId) {
      return res.status(400).json({
        success: false,
        message: "seriesId is required",
      });
    }

    const chapter = await Chapter.create(req.body);

    if (req.io) {
      req.io.emit("chapter_created", chapter);
    }

    res.status(201).json({
      success: true,
      message: "Chapter created successfully",
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET CHAPTERS BY SERIES
exports.getChapterBySeriesId = async (seriesId) => {
  return await Chapter.find({ seriesId });
};

// UPDATE CHAPTER
exports.updateChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }

    if (req.io) {
      req.io.emit("chapter_updated", chapter);
    }

    res.status(200).json({
      success: true,
      message: "Chapter updated successfully",
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// DELETE CHAPTER
exports.deleteChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndDelete(req.params.id);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found",
      });
    }

    if (req.io) {
      req.io.emit("chapter_deleted", {
        id: req.params.id,
      });
    }

    res.status(200).json({
      success: true,
      message: "Chapter deleted successfully",
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// PUBLISH CHAPTER
exports.publishChapter = async (chapterId, req) => {
  const chapter = await Chapter.findByIdAndUpdate(
    chapterId,
    {
      status: CHAPTER_STATUS.COMPLETED,
      publishedAt: new Date(),
    },
    {
      new: true,
    }
  );

  if (!chapter) {
    throw new Error("Chapter not found");
  }

  if (req.io) {
    req.io.emit("chapter_published", chapter);
  }

  return chapter;
};