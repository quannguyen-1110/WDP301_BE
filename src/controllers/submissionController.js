const Submission = require("../models/SeriesSubmission.js");
const Vote = require("../models/Vote.js");
const User = require("../models/User.js");
const { isOverdue } = require("../utils/votingDeadline");

// Blind review: board members must not see the mangaka's identity.
// For BOARD_MEMBER requests we simply omit the mangakaId population so the
// author name/email are not revealed.
const blindReviewPopulate = (req, query) => {
  if (req.user.role === 'BOARD_MEMBER') {
    return query.populate({ path: 'proposalId', select: '-mangakaId' });
  }
  return query.populate({
    path: 'proposalId',
    populate: { path: 'mangakaId', select: 'name email' }
  });
};

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

    const submissions = await blindReviewPopulate(req, query);

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

    const submissions = await blindReviewPopulate(req, query);

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
    const query = Submission.findById(req.params.submissionId);
    const submission = await blindReviewPopulate(req, query);
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
 * Randomly pick N active BOARD_MEMBER users (excluding already-assigned ones).
 */
const pickRandomVoters = async (count, excludeIds = []) => {
  const exclude = excludeIds.map((id) => id.toString());
  const pipeline = [
    {
      $match: {
        role: 'BOARD_MEMBER',
        isActive: { $ne: false },
        deletedAt: null,
        _id: { $nin: exclude.map((id) => new (require('mongoose').Types.ObjectId)(id)) },
      },
    },
    { $sample: { size: count } },
    { $project: { _id: 1 } },
  ];
  const members = await User.aggregate(pipeline);
  return members.map((m) => m._id);
};

/**
 * POST /api/submissions/:submissionId/voters
 * BOARD_MEMBER assigns which users are required to vote on a submission.
 * Supports manual assignment (userIds) OR auto random assignment
 * (autoAssign: true, optional count).
 */
exports.assignVoters = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { userIds, autoAssign, count } = req.body || {};

    const existing = await Submission.findById(submissionId).select('requiredVoters chairpersonId votingDeadline');
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    if (isOverdue(existing)) {
      return res.status(409).json({
        success: false,
        message: 'Voting deadline has passed; voters can no longer be assigned',
      });
    }

    let uniqueUserIds = [];

    if (autoAssign) {
      // Auto random assignment of board members
      const targetCount = Number(count) || 4;
      const existingVoterIds = existing.requiredVoters.map((v) => v.userId);
      uniqueUserIds = await pickRandomVoters(targetCount, existingVoterIds);
      if (uniqueUserIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No eligible BOARD_MEMBER users available for random assignment',
        });
      }
    } else {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "userIds must be a non-empty array",
        });
      }
      uniqueUserIds = [...new Set(userIds.map((id) => id.toString()))];
      // Verify all userIds exist and are BOARD_MEMBERs
      const users = await User.find({ _id: { $in: uniqueUserIds }, role: "BOARD_MEMBER" });
      if (users.length !== uniqueUserIds.length) {
        return res.status(400).json({
          success: false,
          message: "One or more userIds are invalid or not BOARD_MEMBERs",
        });
      }
    }

    const existingIds = new Set(existing.requiredVoters.map((v) => v.userId.toString()));
    const voterEntries = uniqueUserIds
      .filter((id) => !existingIds.has(id.toString()))
      .map((id) => ({ userId: id, hasVoted: false, voteId: null }));

    const submission = await Submission.findByIdAndUpdate(
      submissionId,
      {
        $push: { requiredVoters: { $each: voterEntries } },
        $set: { chairpersonId: existing.chairpersonId || voterEntries[0]?.userId || null },
      },
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
      message: autoAssign
        ? `Randomly assigned ${voterEntries.length} board member(s) as voters`
        : undefined,
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
        votingDeadline: submission.votingDeadline || null,
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