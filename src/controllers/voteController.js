const Vote = require('../models/Vote.js');
const Submission = require('../models/SeriesSubmission.js');
const { logAction } = require('../utils/auditLogger');

exports.submitVote = async (req, res) => {
  try {
    const vote = await Vote.create(req.body);

    // ==================== AUDIT LOG ====================
    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Submitted Vote",
      `Submission ID: ${vote.submissionId}`,
      `Decision: ${vote.decision}, Comment: ${vote.comment || 'No comment'}`
    );

    req.io.emit('vote_submitted', vote);

    // Update the requiredVoters entry...
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
      const allVoted = submission.requiredVoters.every((v) => v.hasVoted === true);

      if (allVoted && submission.requiredVoters.length > 0) {
        const allVotes = await Vote.find({ submissionId: vote.submissionId });
        const acceptCount = allVotes.filter((v) => v.decision === 'ACCEPT').length;
        const rejectCount = allVotes.filter((v) => v.decision === 'REJECT').length;

        let newStatus = acceptCount > rejectCount ? 'APPROVED' : 'REJECTED';

        submission.decisionStatus = newStatus;
        await submission.save();

        await logAction(
          req.user._id,
          req.user.name || 'Board',
          "Submission Decision Made",
          `Submission ID: ${submission._id}`,
          `Result: ${newStatus} (Accept: ${acceptCount}, Reject: ${rejectCount})`
        );

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

exports.getMyVotes = async (req, res) => {
  try {
    const votes = await Vote.find({ userId: req.query.userId });
    res.status(200).json({ success: true, data: votes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

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
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVote = async (req, res) => {
  try {
    const vote = await Vote.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (vote) {
      await logAction(
        req.user._id,
        req.user.name || 'Unknown',
        "Updated Vote",
        `Vote ID: ${req.params.id}`,
        `New decision: ${vote.decision}`
      );
    }

    res.status(200).json({ success: true, data: vote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteVote = async (req, res) => {
  try {
    const vote = await Vote.findByIdAndDelete(req.params.id);

    if (vote) {
      await logAction(
        req.user._id,
        req.user.name || 'Unknown',
        "Deleted Vote",
        `Vote ID: ${req.params.id}`,
        `Submission: ${vote.submissionId}`
      );
    }

    res.status(200).json({ success: true, data: vote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};