const Series = require('../models/Series');

// @desc    Create new series proposal
// @route   POST /api/series
// @access  MANGAKA only
exports.createSeries = async (req, res) => {
  try {
    const { title, synopsis } = req.body;

    const series = await Series.create({
      title,
      synopsis,
      mangakaId: req.user._id,
      status: 'PENDING',
    });

    res.status(201).json({
      success: true,
      data: series,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all series (with optional filters)
// @route   GET /api/series
// @access  All authenticated users
exports.getAllSeries = async (req, res) => {
  try {
    const { status, mangakaId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (mangakaId) filter.mangakaId = mangakaId;

    // If user is MANGAKA, only show their own series
    if (req.user.role === 'MANGAKA') {
      filter.mangakaId = req.user._id;
    }

    const series = await Series.find(filter)
      .populate('mangakaId', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

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

// @desc    Get single series by ID
// @route   GET /api/series/:id
// @access  All authenticated users
exports.getSeriesById = async (req, res) => {
  try {
    const series = await Series.findById(req.params.id)
      .populate('mangakaId', 'name email')
      .populate('reviewedBy', 'name email');

    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found',
      });
    }

    res.status(200).json({
      success: true,
      data: series,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Editor review series (approve/reject)
// @route   PUT /api/series/:id/review
// @access  EDITOR only
exports.reviewSeries = async (req, res) => {
  try {
    const { action, note, pubSchedule } = req.body;

    // Validate action
    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'APPROVED' or 'REJECTED'",
      });
    }

    const series = await Series.findById(req.params.id);
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found',
      });
    }

    // Only PENDING series can be reviewed
    if (series.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot review series with status '${series.status}'. Only PENDING series can be reviewed.`,
      });
    }

    // Update series
    series.status = action;
    series.reviewedBy = req.user._id;
    series.reviewNote = note || '';
    series.reviewedAt = new Date();

    // If approved, set publication schedule
    if (action === 'APPROVED' && pubSchedule) {
      series.pubSchedule = pubSchedule;
    }

    await series.save();

    // Populate for response
    await series.populate('mangakaId', 'name email');
    await series.populate('reviewedBy', 'name email');

    res.status(200).json({
      success: true,
      message: `Series ${action.toLowerCase()} successfully`,
      data: series,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update series status (general purpose)
// @route   PUT /api/series/:id/status
// @access  EDITOR, BOARD_MEMBER
exports.updateSeriesStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validTransitions = {
      PENDING: ['APPROVED', 'REJECTED'],
      APPROVED: ['IN_PRODUCTION', 'CANCELLED'],
      IN_PRODUCTION: ['PUBLISHED', 'CANCELLED'],
    };

    const series = await Series.findById(req.params.id);
    if (!series) {
      return res.status(404).json({
        success: false,
        message: 'Series not found',
      });
    }

    // Validate state transition
    const allowedStatuses = validTransitions[series.status];
    if (!allowedStatuses || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid transition: '${series.status}' → '${status}'. Allowed: ${(allowedStatuses || []).join(', ')}`,
      });
    }

    series.status = status;
    await series.save();

    res.status(200).json({
      success: true,
      message: `Series status updated to '${status}'`,
      data: series,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
