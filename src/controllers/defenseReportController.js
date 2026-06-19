const DefenseReport = require('../models/DefenseReport');
const Series = require('../models/Series');
const Chapter = require('../models/Chapter');
const Rating = require('../models/Rating');
const SeriesRank = require('../models/SeriesRank');

// @desc    Create a new defense report (DRAFT)
// @route   POST /api/defense-reports
// @access  EDITOR only
exports.createDefenseReport = async (req, res) => {
  try {
    const { seriesId, title, defenseArguments, improvementPlan, readerGrowth } = req.body;

    // Verify series exists and editor is assigned
    const series = await Series.findOne({
      _id: seriesId,
      editorId: req.user._id,
    });

    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found or you are not the assigned editor',
      });
    }

    // Auto-populate metrics from database
    const totalChapters = await Chapter.countDocuments({ seriesId: series._id });

    const ratings = await Rating.find({ seriesId: series._id });
    const totalVotes = ratings.reduce((sum, r) => sum + (r.voteCount || 0), 0);

    const latestRankRecord = await SeriesRank.findOne({ seriesId: series._id })
      .sort({ rankedOn: -1 });
    const currentRank = latestRankRecord ? latestRankRecord.rank : null;

    const defenseReport = await DefenseReport.create({
      seriesId: series._id,
      editorId: req.user._id,
      title,
      defenseArguments: defenseArguments || '',
      metrics: {
        totalChapters,
        totalVotes,
        currentRank,
        readerGrowth: readerGrowth || '',
      },
      improvementPlan: improvementPlan || '',
      status: 'DRAFT',
    });

    res.status(201).json({
      success: true,
      data: defenseReport,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get defense reports list
// @route   GET /api/defense-reports
// @access  EDITOR (own reports), BOARD_MEMBER (SUBMITTED+ reports)
exports.getDefenseReports = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'EDITOR') {
      // Editor sees only their own reports
      filter = { editorId: req.user._id };
    } else if (req.user.role === 'BOARD_MEMBER') {
      // Board member sees only SUBMITTED, APPROVED, REJECTED reports
      filter = { status: { $in: ['SUBMITTED', 'APPROVED', 'REJECTED'] } };
    } else {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view defense reports',
      });
    }

    const reports = await DefenseReport.find(filter)
      .populate('seriesId', 'title status imageUrl')
      .populate('editorId', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get a single defense report by ID
// @route   GET /api/defense-reports/:id
// @access  EDITOR (own), BOARD_MEMBER (SUBMITTED+)
exports.getDefenseReportById = async (req, res) => {
  try {
    const report = await DefenseReport.findById(req.params.id)
      .populate('seriesId', 'title status imageUrl synopsis mangakaId')
      .populate('editorId', 'name email')
      .populate('reviewedBy', 'name email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Defense report not found',
      });
    }

    // Access control
    if (req.user.role === 'EDITOR' && report.editorId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this report',
      });
    }

    if (req.user.role === 'BOARD_MEMBER' && report.status === 'DRAFT') {
      return res.status(403).json({
        success: false,
        message: 'Cannot view draft reports',
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update a defense report (only DRAFT status)
// @route   PUT /api/defense-reports/:id
// @access  EDITOR only (owner)
exports.updateDefenseReport = async (req, res) => {
  try {
    const report = await DefenseReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Defense report not found',
      });
    }

    // Only the creator can update
    if (report.editorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this report',
      });
    }

    // Can only update DRAFT reports
    if (report.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Can only update reports in DRAFT status',
      });
    }

    const allowedFields = ['title', 'defenseArguments', 'improvementPlan'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Allow updating readerGrowth in metrics
    if (req.body.readerGrowth !== undefined) {
      updates['metrics.readerGrowth'] = req.body.readerGrowth;
    }

    const updatedReport = await DefenseReport.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('seriesId', 'title status imageUrl')
      .populate('editorId', 'name email');

    res.status(200).json({
      success: true,
      data: updatedReport,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Submit a defense report to Editorial Board
// @route   POST /api/defense-reports/:id/submit
// @access  EDITOR only (owner)
exports.submitDefenseReport = async (req, res) => {
  try {
    const report = await DefenseReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Defense report not found',
      });
    }

    // Only the creator can submit
    if (report.editorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this report',
      });
    }

    // Can only submit DRAFT reports
    if (report.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Can only submit reports in DRAFT status',
      });
    }

    // Validate required fields before submission
    if (!report.defenseArguments || report.defenseArguments.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Defense arguments are required before submission',
      });
    }

    report.status = 'SUBMITTED';
    report.submittedAt = new Date();
    await report.save();

    // Emit socket event for real-time notification
    if (req.io) {
      req.io.emit('defense_report_submitted', {
        reportId: report._id,
        seriesId: report.seriesId,
        title: report.title,
        editorId: report.editorId,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Defense report submitted to Editorial Board',
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Review a defense report (Board decision)
// @route   POST /api/defense-reports/:id/review
// @access  BOARD_MEMBER only
exports.reviewDefenseReport = async (req, res) => {
  try {
    const { decision, reviewNote } = req.body;

    if (!decision || !['CONTINUE', 'CANCEL'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Decision is required and must be either CONTINUE or CANCEL',
      });
    }

    const report = await DefenseReport.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Defense report not found',
      });
    }

    // Can only review SUBMITTED reports
    if (report.status !== 'SUBMITTED') {
      return res.status(400).json({
        success: false,
        message: 'Can only review reports in SUBMITTED status',
      });
    }

    // Update report status based on decision
    report.status = decision === 'CONTINUE' ? 'APPROVED' : 'REJECTED';
    report.reviewedBy = req.user._id;
    report.reviewNote = reviewNote || '';
    report.reviewedAt = new Date();
    await report.save();

    // If CANCEL decision, update series status to CANCELLED
    if (decision === 'CANCEL') {
      await Series.findByIdAndUpdate(report.seriesId, {
        status: 'CANCELLED',
      });
    }

    // Emit socket event for real-time notification
    if (req.io) {
      req.io.emit('defense_report_reviewed', {
        reportId: report._id,
        seriesId: report.seriesId,
        decision,
        reviewedBy: req.user._id,
        status: report.status,
      });
    }

    const populatedReport = await DefenseReport.findById(report._id)
      .populate('seriesId', 'title status imageUrl')
      .populate('editorId', 'name email')
      .populate('reviewedBy', 'name email');

    res.status(200).json({
      success: true,
      message: decision === 'CONTINUE'
        ? 'Series approved to continue'
        : 'Series has been cancelled',
      data: populatedReport,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
