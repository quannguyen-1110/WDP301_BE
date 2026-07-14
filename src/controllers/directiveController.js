const SeriesSubmission = require('../models/SeriesSubmission');
const Series = require('../models/Series');
const User = require('../models/User');
const Vote = require('../models/Vote');
const { logAction } = require('../utils/auditLogger');

const toDirective = async (submission) => {
  const votes = await Vote.find({ submissionId: submission._id })
    .populate('voterId', 'name')
    .lean();
  const series = submission.seriesId;
  const proposedBy = submission.submittedBy;
  return {
    _id: submission._id,
    seriesId: series?._id || series,
    seriesTitle: series?.title || '',
    actionType: submission.action,
    newSchedule: submission.newSchedule,
    reason: submission.reason,
    status: submission.decisionStatus,
    proposedBy: proposedBy?._id || proposedBy,
    proposedByName: proposedBy?.name || '',
    votes: votes.map((vote) => ({
      _id: vote._id,
      voterId: vote.voterId?._id || vote.voterId,
      voterName: vote.voterId?.name || '',
      decision: vote.decision,
      comment: vote.comment,
      createdAt: vote.createdAt,
    })),
    createdAt: submission.createdAt,
  };
};

exports.getDirectives = async (req, res) => {
  try {
    const submissions = await SeriesSubmission.find({ submissionType: 'POST_DECISION' })
      .populate('seriesId', 'title status pubSchedule')
      .populate('submittedBy', 'name')
      .sort({ createdAt: -1 });
    const data = await Promise.all(submissions.map(toDirective));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDirective = async (req, res) => {
  try {
    const { seriesId, actionType, reason, newSchedule } = req.body;
    if (!seriesId || !['CANCEL', 'CHANGE_FORMAT'].includes(actionType) || !reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'seriesId, actionType, and reason are required',
      });
    }
    if (actionType === 'CHANGE_FORMAT' && !['WEEKLY', 'MONTHLY'].includes(newSchedule)) {
      return res.status(400).json({
        success: false,
        message: 'A valid newSchedule is required for CHANGE_FORMAT',
      });
    }
    const series = await Series.findById(seriesId);
    if (!series) {
      return res.status(404).json({ success: false, message: 'Series not found' });
    }
    const boardMembers = await User.find({
      role: 'BOARD_MEMBER',
      isActive: { $ne: false },
      deletedAt: null,
    }).select('_id');
    if (boardMembers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active board members are available to vote',
      });
    }
    const submission = await SeriesSubmission.create({
      seriesId,
      submissionType: 'POST_DECISION',
      submittedBy: req.user._id,
      action: actionType,
      reason: reason.trim(),
      newSchedule: actionType === 'CHANGE_FORMAT' ? newSchedule : null,
      decisionStatus: 'PENDING',
      requiredVoters: boardMembers.map((member) => ({
        userId: member._id,
        hasVoted: false,
        voteId: null,
      })),
    });
    await submission.populate('seriesId', 'title status pubSchedule');
    await submission.populate('submittedBy', 'name');
    await logAction(req.user._id, req.user.name || 'Board', 'Created Directive', series.title, actionType);
    if (req.io) req.io.emit('directive_created', submission);
    return res.status(201).json({ success: true, data: await toDirective(submission) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.voteDirective = async (req, res) => {
  try {
    const { decision, comment } = req.body;
    if (!['ACCEPT', 'REJECT'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid vote decision' });
    }
    const submission = await SeriesSubmission.findOne({
      _id: req.params.directiveId,
      submissionType: 'POST_DECISION',
    });
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Directive not found' });
    }
    if (submission.decisionStatus !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'Directive already decided' });
    }
    const assigned = submission.requiredVoters.some(
      (entry) => entry.userId.toString() === req.user._id.toString(),
    );
    if (!assigned) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this vote' });
    }
    const vote = await Vote.create({
      submissionId: submission._id,
      voterId: req.user._id,
      decision,
      comment,
    });
    const entry = submission.requiredVoters.find(
      (item) => item.userId.toString() === req.user._id.toString(),
    );
    entry.hasVoted = true;
    entry.voteId = vote._id;
    const allVoted = submission.requiredVoters.every((item) => item.hasVoted);
    if (allVoted) {
      const voterIds = submission.requiredVoters.map((item) => item.userId);
      const votes = await Vote.find({ submissionId: submission._id, voterId: { $in: voterIds } });
      const accepts = votes.filter((item) => item.decision === 'ACCEPT').length;
      const rejects = votes.length - accepts;
      submission.decisionStatus = accepts > rejects ? 'APPROVED' : 'REJECTED';
      if (submission.decisionStatus === 'APPROVED') {
        const update = submission.action === 'CANCEL'
          ? { status: 'CANCELLED' }
          : { pubSchedule: submission.newSchedule };
        await Series.findByIdAndUpdate(submission.seriesId, update, { runValidators: true });
      }
    }
    await submission.save();
    await submission.populate('seriesId', 'title status pubSchedule');
    await submission.populate('submittedBy', 'name');
    if (req.io) req.io.emit('directive_voted', { directiveId: submission._id });
    return res.status(201).json({ success: true, data: await toDirective(submission) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'You already voted on this directive' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
