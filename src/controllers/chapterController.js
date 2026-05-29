const Chapter = require('../models/Chapter.js');

const CHAPTER_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
};

exports.createChapter = async (req, res) => {
  try {
    const chapter = await Chapter.create(req.body);
    res.status(201).json({
      success: true,
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getChapterBySeriesId = async (seriesId) => {
  const chapter = await Chapter.find({ series: seriesId });
  return chapter;
};

exports.updateChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndUpdate(req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      data: chapter,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.publishChapter = async (chapterId, req) => {
  const chapter = await Chapter.findByIdAndUpdate(chapterId, {
    status: CHAPTER_STATUS.COMPLETED,
  });
  req.io.emit('chapter_published', chapter);
  return chapter;
};