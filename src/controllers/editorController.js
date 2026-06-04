const Series = require('../models/Series.js');
const Chapter = require('../models/Chapter.js');
const Page = require('../models/Page.js');
const Rating = require('../models/Rating.js');
const SeriesRank = require('../models/SeriesRank.js');

// @desc    Get series managed by the editor
// @route   GET /api/editor/my-series
// @access  EDITOR
exports.getMySeries = async (req, res) => {
  try {
    const series = await Series.find({ editorId: req.user._id })
      .populate('mangakaId', 'name email');

    res.status(200).json({
      success: true,
      count: series.length,
      data: series,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get series metrics & stats to defend before editorial board
// @route   GET /api/editor/series/:seriesId/stats
// @access  EDITOR
exports.getSeriesStats = async (req, res) => {
  try {
    const series = await Series.findOne({
      _id: req.params.seriesId,
      editorId: req.user._id,
    }).populate('mangakaId', 'name email');

    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found or you are not the assigned editor',
      });
    }

    // 1. Get total chapters
    const totalChapters = await Chapter.countDocuments({ seriesId: series._id });

    // 2. Get ratings statistics (total rating count & sum of voteCount)
    const ratings = await Rating.find({ seriesId: series._id });
    const totalVotesSum = ratings.reduce((sum, r) => sum + (r.voteCount || 0), 0);
    const totalRatingEntries = ratings.length;

    // 3. Get current rank
    const latestRankRecord = await SeriesRank.findOne({ seriesId: series._id })
      .sort({ rankedOn: -1 });
    const currentRank = latestRankRecord ? latestRankRecord.rank : null;
    const prevRank = latestRankRecord ? latestRankRecord.prevRank : null;

    res.status(200).json({
      success: true,
      data: {
        series,
        metrics: {
          totalChapters,
          totalRatingEntries,
          totalVotesSum,
          currentRank,
          prevRank,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get real-time studio production progress for a series
// @route   GET /api/editor/series/:seriesId/progress
// @access  EDITOR
exports.getSeriesProgress = async (req, res) => {
  try {
    const series = await Series.findOne({
      _id: req.params.seriesId,
      editorId: req.user._id,
    });

    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found or you are not the assigned editor',
      });
    }

    const chapters = await Chapter.find({ seriesId: series._id })
      .sort({ chapterNumber: 1 });

    const chaptersProgress = [];

    for (const chapter of chapters) {
      const pages = await Page.find({ chapterId: chapter._id });
      const totalPages = pages.length;
      const pagesCompleted = pages.filter(p => p.status === 'COMPLETED' || p.status === 'APPROVED').length;
      const pagesApproved = pages.filter(p => p.status === 'APPROVED').length;
      
      const progressPercent = totalPages > 0 
        ? Math.round((pagesApproved / totalPages) * 100) 
        : 0;

      const isOverdue = chapter.dueAt && new Date(chapter.dueAt) < new Date() && chapter.status !== 'COMPLETED';

      chaptersProgress.push({
        chapterId: chapter._id,
        chapterNumber: chapter.chapterNumber,
        status: chapter.status,
        dueAt: chapter.dueAt,
        totalPages,
        pagesCompleted,
        pagesApproved,
        progress: `${progressPercent}%`,
        isOverdue: !!isOverdue,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        seriesTitle: series.title,
        totalChapters: chapters.length,
        chapters: chaptersProgress,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get editor overview dashboard
// @route   GET /api/editor/dashboard
// @access  EDITOR
exports.getDashboard = async (req, res) => {
  try {
    const mySeries = await Series.find({ editorId: req.user._id });
    const seriesIds = mySeries.map(s => s._id);

    // Get total chapters count across all editor's series
    const totalChapters = await Chapter.countDocuments({ seriesId: { $in: seriesIds } });

    // Find upcoming and overdue deadlines (within next 7 days or past)
    const upcomingDeadlines = await Chapter.find({
      seriesId: { $in: seriesIds },
      status: { $ne: 'COMPLETED' },
      dueAt: { $ne: null },
    })
    .populate('seriesId', 'title')
    .sort({ dueAt: 1 });

    const overdueChapters = upcomingDeadlines.filter(c => new Date(c.dueAt) < new Date());
    const nearDueChapters = upcomingDeadlines.filter(c => new Date(c.dueAt) >= new Date());

    res.status(200).json({
      success: true,
      data: {
        seriesCount: mySeries.length,
        totalChapters,
        series: mySeries,
        deadlines: {
          overdueCount: overdueChapters.length,
          nearDueCount: nearDueChapters.length,
          overdue: overdueChapters.map(c => ({
            chapterId: c._id,
            seriesTitle: c.seriesId ? c.seriesId.title : 'Unknown Series',
            chapterNumber: c.chapterNumber,
            dueAt: c.dueAt,
          })),
          nearDue: nearDueChapters.map(c => ({
            chapterId: c._id,
            seriesTitle: c.seriesId ? c.seriesId.title : 'Unknown Series',
            chapterNumber: c.chapterNumber,
            dueAt: c.dueAt,
          })),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
