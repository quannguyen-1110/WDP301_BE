const fs = require('fs');
const path = require('path');
const SeriesProposal = require('../models/SeriesProposal');
const { logAction } = require('../utils/auditLogger');
const fs = require("fs");
const path = require("path");
const SeriesProposal = require("../models/SeriesProposal");


// @desc    Submit proposal + storyboard file upload
// @route   POST /api/series/proposal
exports.createProposal = async (req, res) => {
  try {
    const { title, genre, synopsis } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Storyboard file is required",
      });
    }

    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const allowedExtensions = [".zip", ".pdf", ".png", ".psd", ".clip"];

    if (!allowedExtensions.includes(fileExt)) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: `Invalid storyboard file type. Allowed extensions: ${allowedExtensions.join(", ")}`,
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
      status: "SUBMITTED",
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

// @desc    Get list of proposals (optionally filtered by status)
// @route   GET /api/series/proposal
// @access  EDITOR only

exports.getProposals = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) {
      filter.status = status;
    }

    const proposals = await SeriesProposal.find(filter)
      .populate("mangakaId", "name email")
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

// @desc    Get single proposal by ID
// @route   GET /api/series/proposal/:id
// @access  EDITOR only
exports.getProposalById = async (req, res) => {
  try {
    const proposal = await SeriesProposal.findById(req.params.id)
      .populate("mangakaId", "name email");

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    res.status(200).json({
      success: true,
      data: proposal,
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
        message: "Proposal not found",
      });
    }

    if (!fs.existsSync(proposal.storyboardPath)) {
      return res.status(404).json({
        success: false,
        message: "Storyboard file not found on server",
      });
    }

    res.download(
      path.resolve(proposal.storyboardPath),
      proposal.storyboardOriginalName,
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// @desc    Editor forward proposal to Board

// @desc    Add a review comment to a proposal
// @route   PUT /api/series/proposal/:id/comment
// @access  EDITOR only
exports.addComment = async (req, res) => {
  const { content, isInternal } = req.body;
  try {
    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    const comment = {
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: "editor",
      content,
      isInternal: isInternal || false,
      createdAt: new Date(),
    };

    proposal.comments.push(comment);
    await proposal.save();

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: proposal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Editor request revision for proposal
// @route   PUT /api/series/proposal/:id/revision
// @access  EDITOR only
exports.requestRevision = async (req, res) => {
  const { content } = req.body;
  try {
    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    if (proposal.status !== "SUBMITTED" && proposal.status !== "UNDER_REVIEW" && proposal.status !== "RESUBMITTED") {
      return res.status(400).json({
        success: false,
        message: `Cannot request revision for proposal with status: ${proposal.status}`,
      });
    }

    proposal.status = "REVISION_REQUESTED";

    const comment = {
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: "editor",
      content: content || "Revision requested",
      isInternal: false,
      createdAt: new Date(),
    };
    proposal.comments.push(comment);

    await proposal.save();

    res.status(200).json({
      success: true,
      message: "Revision requested successfully",
      data: proposal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Editor forward proposal to Editorial Board
// @route   PUT /api/series/proposal/:id/forward
// @access  EDITOR only

exports.forwardProposal = async (req, res) => {
  try {
    const { content } = req.body;

    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    if (proposal.status !== "SUBMITTED" && proposal.status !== "UNDER_REVIEW" && proposal.status !== "RESUBMITTED") {
      return res.status(400).json({
        success: false,
        message: `Cannot forward proposal with status: ${proposal.status}`,
      });
    }

    proposal.status = "APPROVED_BY_TANTOU";

    if (content) {
      const comment = {
        authorId: req.user._id,
        authorName: req.user.name,
        authorRole: "editor",
        content,
        isInternal: false,
        createdAt: new Date(),
      };
      proposal.comments.push(comment);
    }

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
      message: "Proposal approved by Tantou and forwarded to the Editorial Board",
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

// @desc    Editor reject proposal
// @route   PUT /api/series/proposal/:id/reject
// @access  EDITOR only

exports.rejectProposal = async (req, res) => {
  try {
    const { content } = req.body;

    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    proposal.status = "REJECTED";

    if (content) {
      const comment = {
        authorId: req.user._id,
        authorName: req.user.name,
        authorRole: "editor",
        content,
        isInternal: false,
        createdAt: new Date(),
      };
      proposal.comments.push(comment);
    }

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
      message: "Proposal rejected",
      data: proposal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Mangaka resubmit proposal after revision
// @route   PUT /api/series/proposal/:id/resubmit
// @access  MANGAKA only
const resubmitProposal = async (req, res) => {
  try {
    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    if (proposal.status !== "REVISION_REQUESTED") {
      return res.status(400).json({
        success: false,
        message: `Cannot resubmit proposal with status: ${proposal.status}. Only REVISION_REQUESTED proposals can be resubmitted.`,
      });
    }

    proposal.status = "RESUBMITTED";

    const comment = {
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: "mangaka",
      content: "Proposal has been revised and resubmitted.",
      isInternal: false,
      createdAt: new Date(),
    };
    proposal.comments.push(comment);

    await proposal.save();

    res.status(200).json({
      success: true,
      message: "Proposal resubmitted successfully",
      data: proposal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Board sends proposal to editorial board (after tantou approval)
// @route   PUT /api/series/proposal/:id/send-to-board
// @access  EDITOR only
exports.sendToBoard = async (req, res) => {
  try {
    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    if (proposal.status !== "APPROVED_BY_TANTOU") {
      return res.status(400).json({
        success: false,
        message: `Cannot send to board. Current status: ${proposal.status}`,
      });
    }

    proposal.status = "SENT_TO_EDITORIAL_BOARD";
    await proposal.save();

    res.status(200).json({
      success: true,
      message: "Proposal sent to Editorial Board",
      data: proposal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Board approves proposal
// @route   PUT /api/series/proposal/:id/approve
// @access  BOARD only
exports.approveProposal = async (req, res) => {
  try {
    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    if (proposal.status !== "SENT_TO_EDITORIAL_BOARD") {
      return res.status(400).json({
        success: false,
        message: `Cannot approve. Current status: ${proposal.status}`,
      });
    }

    proposal.status = "APPROVED";

    const comment = {
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: "board",
      content: "Proposal approved by Editorial Board.",
      isInternal: false,
      createdAt: new Date(),
    };
    proposal.comments.push(comment);

    await proposal.save();

    res.status(200).json({
      success: true,
      message: "Proposal approved by Editorial Board",
      data: proposal,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};