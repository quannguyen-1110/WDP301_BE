const Series = require('../models/Series.js');
const Chapter = require('../models/Chapter.js');
const Page = require('../models/Page.js');
const Rating = require('../models/Rating.js');
const Ranking = require('../models/Ranking.js');
const Task = require('../models/Task.js');

const formatCycleLabel = (date) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(date));

// @desc    Get series managed by the editor
// @route   GET /api/editor/my-series
// @access  EDITOR
exports.getMySeries = async (req, res) => {
  try {
    const series = await Series.find({ editorId: req.user._id })
      .populate('mangakaId', 'name email')
      .lean();
    const seriesIds = series.map((item) => item._id);
    const chapters = await Chapter.find({ seriesId: { $in: seriesIds } })
      .sort({ chapterNumber: 1 })
      .lean();
    const chapterIds = chapters.map((chapter) => chapter._id);
    const [pages, ratings, rankings] = await Promise.all([
      Page.find({ chapterId: { $in: chapterIds } }).lean(),
      Rating.find({ seriesId: { $in: seriesIds } }).sort({ periodStart: 1 }).lean(),
      Ranking.find({ seriesId: { $in: seriesIds } }).sort({ cycleStart: 1 }).lean(),
    ]);

    const data = series.map((item) => {
      const itemChapters = chapters.filter(
        (chapter) => String(chapter.seriesId) === String(item._id),
      );
      const itemChapterIds = new Set(itemChapters.map((chapter) => String(chapter._id)));
      const itemPages = pages.filter((page) => itemChapterIds.has(String(page.chapterId)));
      const itemRatings = ratings.filter(
        (rating) => String(rating.seriesId) === String(item._id),
      );
      const itemRankings = rankings.filter(
        (ranking) => String(ranking.seriesId) === String(item._id),
      );
      const publishedChapters = itemChapters.filter(
        (chapter) => chapter.status === 'PUBLISHED',
      );
      const approvedPages = itemPages.filter((page) =>
        ['APPROVED', 'COMPLETED'].includes(page.status),
      ).length;
      const latestRating = itemRatings.at(-1);
      const latestRanking = itemRankings.at(-1);
      const previousRanking = itemRankings.at(-2);
      const totalVotes = latestRating?.voteCount || latestRanking?.votes || 0;
      const closestDeadline = itemChapters
        .filter((chapter) => chapter.dueAt && new Date(chapter.dueAt) >= new Date())
        .sort((left, right) => new Date(left.dueAt) - new Date(right.dueAt))[0];
      const currentStage = item.status === 'PUBLISHED'
        || (itemChapters.length && publishedChapters.length === itemChapters.length)
        ? 'PUBLISHED'
        : item.status === 'ACTIVE'
          ? 'LINE_ART'
          : item.status === 'IN_PRODUCTION'
            ? 'DRAFT'
            : 'STORY_PLANNING';
      const completionPercentage = itemPages.length
        ? Math.round((approvedPages / itemPages.length) * 100)
        : 0;
      const latestPublishedChapter = [...publishedChapters]
        .sort((left, right) => right.chapterNumber - left.chapterNumber)[0];
      const startDate = itemChapters
        .map((chapter) => chapter.publishedAt || chapter.createdAt)
        .filter(Boolean)
        .sort((left, right) => new Date(left) - new Date(right))[0] || item.createdAt;
      const monthKeys = Array.from({ length: 6 }, (_, index) => {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - (5 - index));
        return {
          year: date.getFullYear(),
          month: date.getMonth(),
          label: `T${date.getMonth() + 1}`,
        };
      });

      return {
        ...item,
        currentStage,
        completionPercentage,
        deadline: closestDeadline?.dueAt || '',
        remainingDays: closestDeadline
          ? Math.ceil((new Date(closestDeadline.dueAt) - new Date()) / (24 * 60 * 60 * 1000))
          : 0,
        totalChapters: itemChapters.length,
        publishedChapters: publishedChapters.length,
        currentRanking: latestRanking?.rank || 0,
        previousRanking: latestRanking?.prevRank || previousRanking?.rank || 0,
        totalVotes,
        averageVotesPerChapter: publishedChapters.length
          ? Math.round(totalVotes / publishedChapters.length)
          : 0,
        highestVotedChapter: latestPublishedChapter
          ? `Ch.${latestPublishedChapter.chapterNumber}`
          : '',
        latestChapterVotes: totalVotes,
        startDate,
        rankingHistory: itemRankings.slice(-6).map((ranking) => ({
          week: formatCycleLabel(ranking.cycleStart),
          rank: ranking.rank,
        })),
        voteHistory: itemRatings.slice(-6).map((rating) => ({
          chapter: formatCycleLabel(rating.periodStart),
          votes: rating.voteCount,
        })),
        progressHistory: monthKeys.map((entry) => ({
          month: entry.label,
          chaptersCompleted: publishedChapters.filter((chapter) => {
            const date = new Date(chapter.publishedAt || chapter.updatedAt);
            return date.getFullYear() === entry.year && date.getMonth() === entry.month;
          }).length,
          target: item.pubSchedule === 'WEEKLY' ? 4 : 1,
        })),
        productionLogs: itemChapters.map((chapter) => ({
          id: String(chapter._id),
          seriesId: String(item._id),
          stage: chapter.status === 'PUBLISHED' ? 'PUBLISHED' : currentStage,
          description: `Chapter ${chapter.chapterNumber}: ${chapter.title || 'Untitled'} ? ${chapter.totalPages || 0} pages`,
          authorName: item.originalAuthor || item.mangakaId?.name || 'Unknown',
          createdAt: chapter.publishedAt || chapter.updatedAt || chapter.createdAt,
          completionPercentage: chapter.status === 'PUBLISHED' ? 100 : completionPercentage,
        })),
        editorialNotes: item.reviewNote ? [{
          id: `series-note-${item._id}`,
          seriesId: String(item._id),
          content: item.reviewNote,
          authorName: 'Editorial Board',
          createdAt: item.reviewedAt || item.updatedAt || item.createdAt,
          isImportant: false,
        }] : [],
        revisionHistory: [],
      };
    });

    res.status(200).json({
      success: true,
      count: series.length,
      data,
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
    const latestRankRecord = await Ranking.findOne({ seriesId: series._id })
      .sort({ cycleStart: -1 });
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
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Get total chapters count across all editor's series
    const totalChapters = await Chapter.countDocuments({ seriesId: { $in: seriesIds } });
    const pendingReviewCount = await Chapter.countDocuments({
      seriesId: { $in: seriesIds },
      status: { $in: ['SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED'] },
    });

    // Published/completed chapters are terminal work and must never appear as overdue.
    const openDeadlineChapters = await Chapter.find({
      seriesId: { $in: seriesIds },
      status: { $nin: ['PUBLISHED', 'COMPLETED', 'ARCHIVED'] },
      dueAt: { $type: 'date' },
    })
      .populate('seriesId', 'title')
      .sort({ dueAt: 1 });

    const overdueChapters = openDeadlineChapters.filter(c => c.dueAt < now);
    const nearDueChapters = openDeadlineChapters.filter(
      c => c.dueAt >= now && c.dueAt <= sevenDaysFromNow
    );

    res.status(200).json({
      success: true,
      data: {
        seriesCount: mySeries.length,
        totalChapters,
        pendingReviewCount,
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
  exports.getTaskStatistics = async (req, res) => {
  try {
    const series = await Series.findOne({
      _id: req.params.seriesId,
      editorId: req.user._id,
    });

    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found',
      });
    }

    const totalTasks = await Task.countDocuments({
      seriesId: series._id,
    });

    const pendingTasks = await Task.countDocuments({
      seriesId: series._id,
      status: 'PENDING',
    });

    const inProgressTasks = await Task.countDocuments({
      seriesId: series._id,
      status: 'IN_PROGRESS',
    });

    const submittedTasks = await Task.countDocuments({
      seriesId: series._id,
      status: 'SUBMITTED',
    });

    const approvedTasks = await Task.countDocuments({
      seriesId: series._id,
      status: 'APPROVED',
    });

    const revisionTasks = await Task.countDocuments({
      seriesId: series._id,
      status: 'REVISION_REQUESTED',
    });

    res.status(200).json({
      success: true,
      data: {
        totalTasks,
        pendingTasks,
        inProgressTasks,
        submittedTasks,
        approvedTasks,
        revisionTasks,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getOverdueTasks = async (req, res) => {
  try {
    const series = await Series.findOne({
      _id: req.params.seriesId,
      editorId: req.user._id,
    });

    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found',
      });
    }

    const overdueTasks = await Task.find({
      seriesId: series._id,
      dueAt: { $lt: new Date() },
      status: { $nin: ['APPROVED'] },
    })
      .populate('assignedTo', 'name email')
      .populate('chapterId', 'chapterNumber');

    res.status(200).json({
      success: true,
      count: overdueTasks.length,
      data: overdueTasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// @desc    Production overview dashboard
// @route   GET /api/editor/dashboard/production-overview
// @access  EDITOR

exports.getProductionOverview = async (req, res) => {
  try {
    const mySeries = await Series.find({
      editorId: req.user._id,
    });

    const seriesIds = mySeries.map((s) => s._id);

    const totalSeries = mySeries.length;

    const totalTasks = await Task.countDocuments({
      seriesId: { $in: seriesIds },
    });

    const completedTasks = await Task.countDocuments({
      seriesId: { $in: seriesIds },
      status: 'APPROVED',
    });

    const overdueTasks = await Task.countDocuments({
      seriesId: { $in: seriesIds },
      dueAt: { $lt: new Date() },
      status: {
        $nin: ['APPROVED'],
      },
    });

    const totalPages = await Page.countDocuments({
      chapterId: {
        $in: await Chapter.find({
          seriesId: { $in: seriesIds },
        }).distinct('_id'),
      },
    });

    const approvedPages = await Page.countDocuments({
      chapterId: {
        $in: await Chapter.find({
          seriesId: { $in: seriesIds },
        }).distinct('_id'),
      },
      status: 'APPROVED',
    });

    const productionProgress =
      totalPages > 0
        ? Math.round(
            (approvedPages / totalPages) * 100
          )
        : 0;

    res.status(200).json({
      success: true,
      data: {
        totalSeries,
        totalTasks,
        completedTasks,
        overdueTasks,
        totalPages,
        approvedPages,
        productionProgress,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};