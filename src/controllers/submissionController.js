const Submission = require("../models/SeriesSubmission.js");
const Vote = require("../models/Vote.js");
const User = require("../models/User.js");

exports.createSubmission = async (req, res) => {
  try {
    const submission = await Submission.create({
      ...req.body,
      submittedBy: req.user._id,
    });
    res.status(201).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllSubmissionsBySeriesId = async (req, res) => {
  try {
    const { seriesId } = req.params;
    let query = Submission.find({ seriesId });

    const submissions = await query.populate({
      path: 'proposalId',
      populate: { path: 'mangakaId', select: 'name email' }
    });

    res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllSubmissionsByProposal = async (req, res) => {
  try {
    const { proposalStatus } = req.query;
    let query = Submission.find({});

    const submissions = await query.populate({
      path: 'proposalId',
      populate: { path: 'mangakaId', select: 'name email' }
    });

    let result = submissions;
    if (proposalStatus) {
      result = submissions.filter((s) => s.proposalId?.status === proposalStatus);
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateSubmission = async (req, res) => {
  try {
    const submission = await Submission.findByIdAndUpdate(
      req.params.submissionId,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }
    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteSubmission = async (req, res) => {
  try {
    const submission = await Submission.findByIdAndDelete(req.params.submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }
    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }
    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSubmissionByUserId = async (req, res) => {
  try {
    const submissions = await Submission.find({ userId: req.params.userId });
    res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getVotesBySubmissionId = async (req, res) => {
  try {
    const votes = await Vote.find({ submissionId: req.params.submissionId });
    res.status(200).json({
      success: true,
      data: votes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== Required Voters Management =====

/**
 * POST /api/submissions/:submissionId/voters
 * BOARD_MEMBER assigns which users are required to vote on a submission.
 */
exports.assignVoters = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "userIds must be a non-empty array",
      });
    }

    const uniqueUserIds = [...new Set(userIds.map((id) => id.toString()))];
    // Verify all userIds exist and are BOARD_MEMBERs
    const users = await User.find({ _id: { $in: uniqueUserIds }, role: "BOARD_MEMBER" });
    if (users.length !== uniqueUserIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more userIds are invalid or not BOARD_MEMBERs",
      });
    }

    const existing = await Submission.findById(submissionId).select('requiredVoters');
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    const existingIds = new Set(existing.requiredVoters.map((v) => v.userId.toString()));
    const voterEntries = uniqueUserIds
      .filter((id) => !existingIds.has(id.toString()))
      .map((id) => ({ userId: id, hasVoted: false, voteId: null }));

    const submission = await Submission.findByIdAndUpdate(
      submissionId,
      { $push: { requiredVoters: { $each: voterEntries } } },
      { new: true, runValidators: true },
    );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    if (req.io) req.io.emit("voters_assigned", { submissionId, requiredVoters: submission.requiredVoters });

    res.status(200).json({
      success: true,
      data: submission.requiredVoters,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * GET /api/submissions/:submissionId/voters
 * Returns voting status for all required voters on a submission.
 */
exports.getVotingStatus = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId)
      .populate("requiredVoters.userId", "name email role");

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const totalRequired = submission.requiredVoters.length;
    const votedCount = submission.requiredVoters.filter((v) => v.hasVoted).length;
    const allVoted = totalRequired > 0 && votedCount === totalRequired;

    res.status(200).json({
      success: true,
      data: {
        submissionId: submission._id,
        decisionStatus: submission.decisionStatus,
        totalRequired,
        votedCount,
        allVoted,
        voters: submission.requiredVoters,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};