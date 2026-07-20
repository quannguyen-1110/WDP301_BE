const SeriesProposal = require("../models/SeriesProposal");
const Submission = require("../models/SeriesSubmission");
const Series = require("../models/Series");
const { logAction } = require("../utils/auditLogger");
const { cloudinary } = require("../config/cloudinary");
const axios = require("axios");

// @desc    Submit proposal + storyboard file upload (Cloudinary)
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

    const proposal = await SeriesProposal.create({
      title,
      genre,
      synopsis,
      storyboardUrl: req.file.path,
      storyboardPath: req.file.path,
      storyboardOriginalName: req.file.originalname,
      mangakaId: req.user._id,
      status: "SUBMITTED",
    });

    // Ghi Audit Log
    await logAction(
      req.user._id,
      req.user.name || "Unknown User",
      "Created Series Proposal",
      `Title: ${title}`,
      `Genre: ${genre}`,
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
    const proposal = await SeriesProposal.findById(req.params.id).populate(
      "mangakaId",
      "name email",
    );

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

// @desc    Download storyboard file (proxied through backend)
exports.downloadStoryboard = async (req, res) => {
  try {
    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    if (!proposal.storyboardUrl) {
      return res.status(404).json({
        success: false,
        message: "Storyboard URL not available",
      });
    }

    // Fetch the actual file from Cloudinary
    const response = await axios.get(proposal.storyboardUrl, {
      responseType: "stream",
    });

    // Set headers for file download
    const originalName = "storyboard";
    res.setHeader("Content-Type", response.headers["content-type"] || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${originalName}"`);

    // Pipe the file stream directly to the client
    response.data.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download storyboard",
    });
  }
};

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

    if (
      proposal.status !== "SUBMITTED" &&
      proposal.status !== "UNDER_REVIEW" &&
      proposal.status !== "RESUBMITTED"
    ) {
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

    // Create Notification for the Mangaka
    const notification = await Notification.create({
      userId: proposal.mangakaId,
      title: "Revision Requested for Proposal",
      content: `Editor has requested revision for your proposal "${proposal.title}". Reason: ${content || "Revision requested"}`,
      type: "WARNING",
    });

    if (req.io) {
      req.io.emit("notification", notification);
    }

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

    if (
      proposal.status !== "SUBMITTED" &&
      proposal.status !== "UNDER_REVIEW" &&
      proposal.status !== "RESUBMITTED"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot forward proposal with status: ${proposal.status}`,
      });
    }

    // Update status to SENT_TO_EDITORIAL_BOARD so it is visible to the Editorial Board
    proposal.status = "SENT_TO_EDITORIAL_BOARD";

    let commentData = null;
    if (content) {
      commentData = {
        authorId: req.user._id,
        authorName: req.user.name,
        authorRole: "editor",
        content,
        isInternal: false,
        createdAt: new Date(),
      };
      proposal.comments.push(commentData);
    }

    await proposal.save();

    await Submission.findOneAndUpdate(
      { proposalId: proposal._id, submissionType: "PITCH" },
      {
        $setOnInsert: {
          proposalId: proposal._id,
          submittedBy: req.user._id,
          submissionType: "PITCH",
          decisionStatus: "PENDING",
          requiredVoters: [],
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    await logAction(
      req.user._id,
      req.user.name || "Unknown User",
      "Forwarded Proposal to Board",
      `Proposal: ${proposal.title}`,
      commentData ? `Comment: ${commentData.content}` : "",
    );

    res.status(200).json({
      success: true,
      message:
        "Proposal approved by Tantou and forwarded to the Editorial Board",
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
    let commentData = null;

    let comment = null;
    if (content) {
      commentData = {
        authorId: req.user._id,
        authorName: req.user.name,
        authorRole: "editor",
        content,
        isInternal: false,
        createdAt: new Date(),
      };
      proposal.comments.push(commentData);
    }

    await proposal.save();

    // Create Notification for the Mangaka
    const notification = await Notification.create({
      userId: proposal.mangakaId,
      title: "Proposal Rejected",
      content: `Your proposal "${proposal.title}" has been rejected by the Editor.`,
      type: "WARNING",
    });

    if (req.io) {
      req.io.emit("notification", notification);
    }

    await logAction(
      req.user._id,
      req.user.name || "Unknown User",
      "Rejected Proposal",
      `Proposal: ${proposal.title}`,
      commentData?.content || "",
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
exports.resubmitProposal = async (req, res) => {
  try {
    const proposal = await SeriesProposal.findById(req.params.id);

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: "Proposal not found",
      });
    }

    if (proposal.mangakaId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only resubmit your own proposal",
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

    const approvedSubmission = await Submission.findOne({
      proposalId: proposal._id,
      submissionType: "PITCH",
      decisionStatus: "APPROVED",
    });
    if (!approvedSubmission) {
      return res.status(409).json({
        success: false,
        message:
          "Board approval must be completed through the assigned voting session",
      });
    }
    const series = await Series.findOne({ proposalId: proposal._id });
    if (!series) {
      return res.status(409).json({
        success: false,
        message: "The approved submission has not provisioned its series yet",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Proposal was approved through board voting",
      data: proposal,
    });

    if (proposal.status !== "APPROVED_BY_TANTOU") {
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

    // Create Notification for the Mangaka
    const notification = await Notification.create({
      userId: proposal.mangakaId,
      title: "Proposal Approved by Board",
      content: `Congratulations! Your proposal "${proposal.title}" has been approved by the Editorial Board.`,
      type: "INFO",
    });

    if (req.io) {
      req.io.emit("notification", notification);
    }

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
