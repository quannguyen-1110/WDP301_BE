const fs = require('fs');
const path = require('path');
const SeriesProposal = require('../models/SeriesProposal');
const { logAction } = require('../utils/auditLogger');

// @desc    Submit proposal + storyboard file upload
// @route   POST /api/series/proposal
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
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: `Invalid storyboard file type. Allowed extensions: ${allowedExtensions.join(', ')}`,
      });
    }

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

    // Ghi Audit Log
    await logAction(
      req.user._id,
      req.user.name || 'Unknown User',
      "Created Series Proposal",
      `Title: ${title}`,
      `Genre: ${genre}`
    );

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

    await logAction(
      req.user._id,
      req.user.name || 'Unknown User',
      "Forwarded Proposal to Board",
      `Proposal: ${proposal.title}`,
      comment ? `Comment: ${comment}` : ''
    );

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

    await logAction(
      req.user._id,
      req.user.name || 'Unknown User',
      "Rejected Proposal",
      `Proposal: ${proposal.title}`,
      comment || ''
    );

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

module.exports = {
  createProposal,
  getProposals,
  downloadStoryboard,
  forwardProposal,
  rejectProposal,
};