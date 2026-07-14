const Series = require('../models/Series');
const { logAction } = require('../utils/auditLogger');

// @desc    Create new series
exports.createSeries = async (req, res) => {
  try {
    const { title, synopsis } = req.body;

    const series = await Series.create({
      title,
      synopsis,
      mangakaId: req.user._id,
      status: 'PENDING',
    });

    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Created Series",
      `Title: ${title}`,
      `Status: PENDING`
    );

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

// @desc    Get all series
exports.getAllSeries = async (req, res) => {
  try {
    const { status, mangakaId } = req.query;
    const filter = {};
    if (req.user.role === 'EDITOR') {
      filter.editorId = req.user._id;
    }

    if (status) filter.status = status;
    if (mangakaId) filter.mangakaId = mangakaId;

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

    const mangakaId = series.mangakaId?._id || series.mangakaId;
    if (
      (req.user.role === 'MANGAKA' && mangakaId.toString() !== req.user._id.toString()) ||
      (
        req.user.role === 'EDITOR' &&
        (!series.editorId || series.editorId.toString() !== req.user._id.toString())
      )
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this series',
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
exports.reviewSeries = async (req, res) => {
  try {
    const { action, note, pubSchedule } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'APPROVED' or 'REJECTED'",
      });
    }

    const series = await Series.findById(req.params.id);
    if (!series) {
      return res.status(404).json({ success: false, message: 'Series not found' });
    }

    if (series.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot review series with status '${series.status}'`,
      });
    }

    series.status = action;
    series.reviewedBy = req.user._id;
    series.reviewNote = note || '';
    series.reviewedAt = new Date();

    if (action === 'APPROVED' && pubSchedule) {
      series.pubSchedule = pubSchedule;
    }

    await series.save();

    await series.populate('mangakaId', 'name email');
    await series.populate('reviewedBy', 'name email');

    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      action === 'APPROVED' ? "Approved Series" : "Rejected Series",
      `Series: ${series.title}`,
      note ? `Note: ${note}` : ''
    );

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

// @desc    Update series status
exports.updateSeriesStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validTransitions = {
      PENDING: ['APPROVED', 'REJECTED'],
      APPROVED: ['IN_PRODUCTION', 'CANCELLED'],
      IN_PRODUCTION: ['PUBLISHED', 'CANCELLED'],
      PUBLISHED: ['IN_PRODUCTION', 'CANCELLED', 'REJECTED'],
      REJECTED: ['PENDING', 'CANCELLED'],
      ACTIVE: ['IN_PRODUCTION', 'CANCELLED', 'REJECTED'],
      CANCELLED: ['IN_PRODUCTION', 'PENDING', 'REJECTED'],
      ON_HIATUS: ['IN_PRODUCTION', 'PENDING', 'REJECTED'],
      COMPLETED: ['IN_PRODUCTION', 'PENDING', 'REJECTED'],
    };

    const series = await Series.findById(req.params.id);
    if (!series) {
      return res.status(404).json({ success: false, message: 'Series not found' });
    }

    const allowedStatuses = validTransitions[series.status];
    if (!allowedStatuses || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid transition: '${series.status}' → '${status}'`,
      });
    }

    series.status = status;
    await series.save();

    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Updated Series Status",
      `Series: ${series.title}`,
      `New status: ${status}`
    );

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