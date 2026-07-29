const Vote = require('../models/Vote');
const Submission = require('../models/SeriesSubmission');
const SeriesProposal = require('../models/SeriesProposal');
const Series = require('../models/Series');
const Notification = require('../models/Notification');
const { logAction } = require('../utils/auditLogger');

const PROPOSAL_DECISIONS = ['ACCEPT', 'REJECT'];

const finalizeProposal = async (req, submission, decision, decidedBy) => {
  submission.decisionStatus = decision === 'ACCEPT' ? 'APPROVED' : 'REJECTED';
  submission.tiedDecisions = [];
  submission.decidedBy = decidedBy;
  submission.decidedAt = new Date();

  if (decision === 'ACCEPT') {
    const proposal = await SeriesProposal.findById(submission.proposalId);
    if (proposal) {
      const series = await Series.findOneAndUpdate(
        { proposalId: proposal._id },
        {
          $setOnInsert: {
            title: proposal.title,
            synopsis: proposal.synopsis,
            mangakaId: proposal.mangakaId,
            editorId: submission.submittedBy,
            status: 'ACTIVE',
            proposalId: proposal._id,
          },
        },
        { new: true, upsert: true, runValidators: true },
      );
      series.status = 'ACTIVE';
      await series.save();

      submission.seriesId = series._id;
      proposal.status = 'APPROVED';
      proposal.seriesId = series._id;
      await proposal.save();

      // Notify Mangaka
      const approveNotification = await Notification.create({
        userId: proposal.mangakaId,
        title: 'Series Approved by Board!',
        content: `Congratulations! Your series "${proposal.title}" has been approved by the Editorial Board and is now ACTIVE.`,
        type: 'INFO',
      });

      if (req.io) {
        req.io.emit('notification', approveNotification);
        req.io.to(proposal.mangakaId.toString()).emit('notification', approveNotification);
        req.io.emit('series_approved', {
          seriesId: series._id,
          title: series.title,
          status: 'ACTIVE',
        });
      }
    }
  } else {
    const proposal = await SeriesProposal.findByIdAndUpdate(
      submission.proposalId,
      { $set: { status: 'REJECTED' } },
      { new: true, runValidators: true },
    );
    if (proposal) {
      const series = await Series.findOneAndUpdate(
        { proposalId: proposal._id },
        { $set: { status: 'REJECTED' } },
        { new: true }
      );

      // Notify Mangaka
      const rejectNotification = await Notification.create({
        userId: proposal.mangakaId,
        title: 'Series Rejected by Board',
        content: `Unfortunately, your series "${proposal.title}" has been rejected by the Editorial Board.`,
        type: 'WARNING',
      });

      if (req.io) {
        req.io.emit('notification', rejectNotification);
        req.io.to(proposal.mangakaId.toString()).emit('notification', rejectNotification);
        req.io.emit('series_rejected', {
          seriesId: series ? series._id : null,
          title: proposal.title,
          status: 'REJECTED',
        });
      }
    }
  }

  await submission.save();
  await logAction(
    decidedBy,
    req.user.name || 'Editorial Board',
    'Proposal Decision Made',
    `Submission ID: ${submission._id}`,
    `Result: ${submission.decisionStatus}`,
  );
  if (req.io) {
    req.io.emit('submission_decided', {
      submissionId: submission._id,
      decisionStatus: submission.decisionStatus,
    });
  }
};

const evaluateProposal = async (req, submission) => {
  const allVoted = submission.requiredVoters.length > 0
    && submission.requiredVoters.every((entry) => entry.hasVoted);
  if (!allVoted) return;

  const voterIds = submission.requiredVoters.map((entry) => entry.userId);
  const votes = await Vote.find({
    submissionId: submission._id,
    voterId: { $in: voterIds },
  });
  const accepts = votes.filter((vote) => vote.decision === 'ACCEPT').length;
  const rejects = votes.filter((vote) => vote.decision === 'REJECT').length;

  if (accepts === rejects) {
    submission.decisionStatus = 'TIE_BREAK_REQUIRED';
    submission.tiedDecisions = ['ACCEPT', 'REJECT'];
    if (!submission.chairpersonId && submission.requiredVoters[0]) {
      submission.chairpersonId = submission.requiredVoters[0].userId;
    }
    await submission.save();
    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Proposal Tie Detected',
      `Submission ID: ${submission._id}`,
      `Accept: ${accepts}; Reject: ${rejects}`,
    );
    return;
  }

  await finalizeProposal(
    req,
    submission,
    accepts > rejects ? 'ACCEPT' : 'REJECT',
    req.user._id,
  );
};

exports.submitVote = async (req, res) => {
  try {
    const { submissionId, decision, comment } = req.body || {};
    if (!submissionId || !PROPOSAL_DECISIONS.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'submissionId and a valid decision are required',
      });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    if (submission.submissionType !== 'PITCH') {
      return res.status(409).json({
        success: false,
        message: 'Use the dedicated endpoint for this submission type',
      });
    }
    if (submission.decisionStatus !== 'PENDING') {
      return res.status(409).json({
        success: false,
        message: 'This proposal submission is not open for voting',
      });
    }

    const voterEntry = submission.requiredVoters.find(
      (entry) => entry.userId.toString() === req.user._id.toString(),
    );
    if (!voterEntry) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to vote on this submission',
      });
    }
    if (voterEntry.hasVoted) {
      return res.status(409).json({
        success: false,
        message: 'You have already voted on this submission',
      });
    }

    const vote = await Vote.create({
      submissionId,
      voterId: req.user._id,
      decision,
      comment: comment?.trim() || '',
    });
    voterEntry.hasVoted = true;
    voterEntry.voteId = vote._id;
    await submission.save();

    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Submitted Proposal Vote',
      `Submission ID: ${submission._id}`,
      `Decision: ${decision}`,
    );
    await evaluateProposal(req, submission);
    if (req.io) req.io.emit('vote_submitted', vote);

    return res.status(201).json({ success: true, data: vote });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already voted on this submission',
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.tieBreakProposal = async (req, res) => {
  try {
    const { decision } = req.body || {};
    if (!PROPOSAL_DECISIONS.includes(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid tie-break decision' });
    }

    const submission = await Submission.findOne({
      _id: req.params.id,
      submissionType: 'PITCH',
    });
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Proposal submission not found' });
    }
    if (submission.decisionStatus !== 'TIE_BREAK_REQUIRED') {
      return res.status(409).json({
        success: false,
        message: 'This proposal does not require a tie-break',
      });
    }

    const isChairperson = submission.chairpersonId
      && submission.chairpersonId.toString() === req.user._id.toString();
    if (req.user.role !== 'ADMIN' && !isChairperson) {
      return res.status(403).json({
        success: false,
        message: 'Only the chairperson or an admin can break this tie',
      });
    }
    if (!submission.tiedDecisions.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'The decision must be one of the tied decisions',
      });
    }

    await finalizeProposal(req, submission, decision, req.user._id);
    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Broke Proposal Tie',
      `Submission ID: ${submission._id}`,
      `Decision: ${decision}`,
    );
    return res.status(200).json({ success: true, data: submission });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyVotes = async (req, res) => {
  try {
    const votes = await Vote.find({ voterId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: votes });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVotesBySubmission = async (req, res) => {
  try {
    const votes = await Vote.find({ submissionId: req.params.id })
      .populate('voterId', 'name email role')
      .sort({ createdAt: 1 });
    return res.status(200).json({
      success: true,
      count: votes.length,
      data: votes,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVote = async (req, res) => {
  try {
    if (!PROPOSAL_DECISIONS.includes(req.body.decision)) {
      return res.status(400).json({ success: false, message: 'Invalid vote decision' });
    }
    const existingVote = await Vote.findById(req.params.voteId);
    if (!existingVote) {
      return res.status(404).json({ success: false, message: 'Vote not found' });
    }
    const submission = await Submission.findById(existingVote.submissionId);
    if (!submission
      || submission.submissionType !== 'PITCH'
      || submission.decisionStatus !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'Votes cannot be changed after voting closes' });
    }

    existingVote.decision = req.body.decision;
    existingVote.comment = req.body.comment?.trim() || '';
    await existingVote.save();
    await logAction(
      req.user._id,
      req.user.name || 'Admin',
      'Updated Vote',
      `Vote ID: ${existingVote._id}`,
      `Decision: ${existingVote.decision}`,
    );
    return res.status(200).json({ success: true, data: existingVote });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteVote = async (req, res) => {
  try {
    const vote = await Vote.findById(req.params.voteId);
    if (!vote) {
      return res.status(404).json({ success: false, message: 'Vote not found' });
    }
    const submission = await Submission.findById(vote.submissionId);
    if (!submission
      || submission.submissionType !== 'PITCH'
      || submission.decisionStatus !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'Votes cannot be deleted after voting closes' });
    }

    await vote.deleteOne();
    const voterEntry = submission.requiredVoters.find(
      (entry) => entry.userId.toString() === vote.voterId.toString(),
    );
    if (voterEntry) {
      voterEntry.hasVoted = false;
      voterEntry.voteId = null;
      await submission.save();
    }

    await logAction(
      req.user._id,
      req.user.name || 'Admin',
      'Deleted Vote',
      `Vote ID: ${vote._id}`,
      `Submission: ${vote.submissionId}`,
    );
    return res.status(200).json({ success: true, data: vote });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
