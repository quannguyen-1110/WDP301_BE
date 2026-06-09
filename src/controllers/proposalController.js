const fs = require('fs');
const path = require('path');
const SeriesProposal = require('../models/SeriesProposal');

// @desc    Submit proposal + storyboard file upload
// @route   POST /api/series/proposal
// @access  MANGAKA only
exports.createProposal = async (req, res) => {
  try {
    const { title, genre, synopsis } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Storyboard file is required',
      });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const allowedExtensions = ['.zip', '.pdf', '.png', '.psd', '.clip'];

    if (!allowedExtensions.includes(fileExt)) {
      // Delete uploaded file if extension is invalid
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: `Invalid storyboard file type. Allowed extensions: ${allowedExtensions.join(', ')}`,
      });
    }

    // Prepare storyboardUrl
    const storyboardUrl = `/api/series/proposal/file/${req.file.filename}`;

    const proposal = await SeriesProposal.create({
      title,
      genre,
      synopsis,
      storyboardUrl,
      storyboardPath: req.file.path,
      storyboardOriginalName: req.file.originalname,
      mangakaId: req.user._id,
      status: 'PENDING',
    });

    res.status(201).json({
      success: true,
      data: {
        _id: proposal._id,
        title: proposal.title,
        genre: proposal.genre,
        synopsis: proposal.synopsis,
        storyboardUrl: proposal.storyboardUrl,
        status: proposal.status,
        submittedAt: proposal.submittedAt,
      },
    });
  } catch (error) {
    // Cleanup file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get list of proposals pending review
// @route   GET /api/series/proposal
// @access  EDITOR only
exports.getProposals = async (req, res) => {
  try {
    const proposals = await SeriesProposal.find({ status: 'PENDING' })
      .populate('mangakaId', 'name email')
      .sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      count: proposals.length,
      data: proposals,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Download storyboard file
// @route   GET /api/series/proposal/:id/storyboard
// @access  EDITOR only
exports.downloadStoryboard = async (req, res) => {
  try {
    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }

    if (!fs.existsSync(proposal.storyboardPath)) {
      return res.status(404).json({
        success: false,
        message: 'Storyboard file not found on server',
      });
    }

    res.download(path.resolve(proposal.storyboardPath), proposal.storyboardOriginalName);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Editor forward proposal to Board
// @route   PUT /api/series/proposal/:id/forward
// @access  EDITOR only
exports.forwardProposal = async (req, res) => {
  try {
    const { comment } = req.body;

    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }

    proposal.status = 'FORWARDED';
    proposal.comment = comment || '';
    await proposal.save();

    res.status(200).json({
      success: true,
      message: 'Proposal successfully forwarded to the Board',
      data: proposal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Editor reject / request changes for proposal
// @route   PUT /api/series/proposal/:id/reject
// @access  EDITOR only
exports.rejectProposal = async (req, res) => {
  try {
    const { comment } = req.body;

    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Proposal not found',
      });
    }

    proposal.status = 'REJECTED';
    proposal.comment = comment || '';
    await proposal.save();

    res.status(200).json({
      success: true,
      message: 'Proposal successfully rejected / feedback sent',
      data: proposal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
