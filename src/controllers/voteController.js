const Vote = require('../models/Vote.js');
const Submission = require('../models/SeriesSubmission.js');

exports.submitVote = async (req, res) => {
  try {
    const vote = await Vote.create(req.body);
    req.io.emit('vote_submitted', vote);

    // Update the requiredVoters entry for this voter
    const submission = await Submission.findOneAndUpdate(
      {
        _id: vote.submissionId,
        'requiredVoters.userId': vote.voterId,
      },
      {
        $set: {
          'requiredVoters.$.hasVoted': true,
          'requiredVoters.$.voteId': vote._id,
        },
      },
      { new: true },
    );

    if (submission) {
      // Check if ALL required voters have voted
      const allVoted = submission.requiredVoters.every((v) => v.hasVoted === true);

      if (allVoted && submission.requiredVoters.length > 0) {
        // Count ACCEPT vs REJECT among all votes for this submission
        const allVotes = await Vote.find({ submissionId: vote.submissionId });
        const acceptCount = allVotes.filter((v) => v.decision === 'ACCEPT').length;
        const rejectCount = allVotes.filter((v) => v.decision === 'REJECT').length;

        let newStatus;
        if (acceptCount > rejectCount) {
          newStatus = 'APPROVED';
        } else {
          // Tie or reject majority → REJECTED
          newStatus = 'REJECTED';
        }

        submission.decisionStatus = newStatus;
        await submission.save();

        req.io.emit('submission_decided', {
          submissionId: submission._id,
          decisionStatus: newStatus,
          acceptCount,
          rejectCount,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: vote,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateVote = async (req, res) => {
  try {
    const votes = await Vote.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
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

exports.deleteVote = async (req, res) => {
  try {
    const votes = await Vote.findByIdAndDelete(req.params.id);
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

exports.getMyVotes = async (req, res) => {
  try {
    const votes = await Vote.find({ userId: req.query.userId });
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

// @desc    Get all votes for a submission
// @route   GET /api/votes/submission/:id
// @access  BOARD_MEMBER
exports.getVotesBySubmission = async (req, res) => {
  try {
    const votes = await Vote.find({ submissionId: req.params.id })
      .populate('voterId', 'name email');

    res.status(200).json({
      success: true,
      count: votes.length,
      data: votes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
