const mongoose = require('mongoose');
const SeriesSubmission = require('../models/SeriesSubmission');
const Series = require('../models/Series');
const User = require('../models/User');
const Vote = require('../models/Vote');
const Notification = require('../models/Notification');
const { logAction } = require('../utils/auditLogger');
const { deadlineFromNow, isOverdue } = require('../utils/votingDeadline');

/**
 * Randomly pick N active BOARD_MEMBER users (optionally excluding ids).
 */
const pickRandomBoardMembers = async (count, excludeIds = []) => {
  const exclude = excludeIds.map((id) => id.toString());
  const pipeline = [
    {
      $match: {
        role: 'BOARD_MEMBER',
        isActive: { $ne: false },
        deletedAt: null,
        _id: { $nin: exclude.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    { $sample: { size: count } },
    { $project: { _id: 1 } },
  ];
  const members = await User.aggregate(pipeline);
  return members.map((m) => m._id);
};

const DIRECTIVE_ACTIONS = ['CONTINUE', 'CANCEL', 'CHANGE_FORMAT'];
const VOTE_DECISIONS = ['ACCEPT', 'REJECT'];

const tallyVotes = (votes, required) => ({
  ACCEPT: votes.filter((vote) => vote.decision === 'ACCEPT').length,
  REJECT: votes.filter((vote) => vote.decision === 'REJECT').length,
  total: votes.length,
  required,
});

const toDirective = async (submission) => {
  const votes = await Vote.find({ submissionId: submission._id })
    .populate('voterId', 'name email role')
    .sort({ createdAt: 1 });
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
    votingDeadline: submission.votingDeadline || null,
    chairpersonId: submission.chairpersonId?._id || submission.chairpersonId,
    chairpersonName: submission.chairpersonId?.name || '',
    tiedDecisions: submission.tiedDecisions,
    decidedBy: submission.decidedBy,
    decidedAt: submission.decidedAt,
    requiredVoters: submission.requiredVoters,
    proposedBy: proposedBy?._id || proposedBy,
    proposedByName: proposedBy?.name || '',
    votes,
    tally: tallyVotes(votes, submission.requiredVoters.length),
    createdAt: submission.createdAt,
  };
};

const populateDirective = (query) => query
  .populate('seriesId', 'title status pubSchedule mangakaId editorId')
  .populate('submittedBy', 'name role')
  .populate('chairpersonId', 'name role')
  .populate('requiredVoters.userId', 'name email role');

const emitNotification = (req, notification) => {
  if (!req.io) return;
  req.io.to(notification.userId.toString()).emit('notification', notification);
};

const notifyDirectiveOutcome = async (req, series, submission, approved, comment) => {
  const recipientIds = [series.mangakaId, series.editorId]
    .filter(Boolean)
    .map((id) => id.toString());
  const uniqueRecipientIds = [...new Set(recipientIds)];
  if (uniqueRecipientIds.length === 0) return;

  const result = approved ? 'APPROVED' : 'REJECTED';
  const note = comment?.trim() ? ` Comment: ${comment.trim()}` : '';
  const notifications = await Notification.insertMany(
    uniqueRecipientIds.map((userId) => ({
      userId,
      title: `Series directive ${result}`,
      content: `${submission.action} for "${series.title}" was ${result}.${note}`,
      type: approved ? 'INFO' : 'WARNING',
      link: `/editor/series/${series._id}`,
      targetType: 'SERIES',
      targetId: series._id,
    })),
  );
  notifications.forEach((notification) => emitNotification(req, notification));
};

const applyApprovedDirective = async (submission, series) => {
  if (submission.action === 'CANCEL') {
    series.status = 'CANCELLED';
    await series.save();
  } else if (submission.action === 'CHANGE_FORMAT') {
    series.pubSchedule = submission.newSchedule;
    await series.save();
  }
  // CONTINUE records the Board decision without overwriting the current
  // lifecycle state (for example IN_PRODUCTION or ON_HIATUS).
};

const finalizeDirective = async (req, submission, decision, comment, decidedBy) => {
  const series = await Series.findById(submission.seriesId);
  if (!series) throw new Error('Series not found while applying directive');

  const approved = decision === 'ACCEPT';
  if (approved) await applyApprovedDirective(submission, series);

  submission.decisionStatus = approved ? 'APPROVED' : 'REJECTED';
  submission.tiedDecisions = [];
  submission.decidedBy = decidedBy;
  submission.decidedAt = new Date();
  await submission.save();

  await notifyDirectiveOutcome(req, series, submission, approved, comment);
  await logAction(
    decidedBy,
    req.user.name || 'Editorial Board',
    'Directive Decision Made',
    `Directive ID: ${submission._id}`,
    `Action: ${submission.action}; Result: ${submission.decisionStatus}`,
  );
  if (req.io) {
    req.io.emit('directive_decided', {
      directiveId: submission._id,
      action: submission.action,
      status: submission.decisionStatus,
    });
  }
};

const evaluateDirective = async (req, submission) => {
  const allVoted = submission.requiredVoters.length > 0
    && submission.requiredVoters.every((entry) => entry.hasVoted);
  const deadlineReached = isOverdue(submission);
  if (!allVoted && !deadlineReached) return;

  const voterIds = submission.requiredVoters.map((entry) => entry.userId);
  const votes = await Vote.find({
    submissionId: submission._id,
    voterId: { $in: voterIds },
  });
  const tally = tallyVotes(votes, submission.requiredVoters.length);

  // If the deadline passed and nobody voted, reject the directive rather
  // than leaving it stuck in PENDING.
  if (deadlineReached && votes.length === 0) {
    await finalizeDirective(req, submission, 'REJECT', '', req.user._id);
    return;
  }

  if (tally.ACCEPT === tally.REJECT) {
    submission.decisionStatus = 'TIE_BREAK_REQUIRED';
    submission.tiedDecisions = ['ACCEPT', 'REJECT'];
    await submission.save();
    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Directive Tie Detected',
      `Directive ID: ${submission._id}`,
      `Accept: ${tally.ACCEPT}; Reject: ${tally.REJECT}`,
    );
    return;
  }

  await finalizeDirective(
    req,
    submission,
    tally.ACCEPT > tally.REJECT ? 'ACCEPT' : 'REJECT',
    '',
    req.user._id,
  );
};

exports.getDirectives = async (req, res) => {
  try {
    const submissions = await populateDirective(
      SeriesSubmission.find({ submissionType: 'POST_DECISION' })
        .sort({ createdAt: -1 }),
    );
    const data = await Promise.all(submissions.map(toDirective));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDirective = async (req, res) => {
  try {
    const {
      seriesId,
      actionType,
      reason,
      newSchedule,
      voterIds,
      chairpersonId,
      autoAssign,
    } = req.body || {};
    if (!mongoose.isValidObjectId(seriesId)
      || !DIRECTIVE_ACTIONS.includes(actionType)
      || !reason?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A valid seriesId, actionType, and reason are required',
      });
    }
    if (actionType === 'CHANGE_FORMAT' && !['WEEKLY', 'MONTHLY'].includes(newSchedule)) {
      return res.status(400).json({
        success: false,
        message: 'A valid newSchedule is required for CHANGE_FORMAT',
      });
    }
    if (voterIds !== undefined && (!Array.isArray(voterIds) || voterIds.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'voterIds must be a non-empty array when provided',
      });
    }

    const series = await Series.findById(seriesId);
    if (!series) {
      return res.status(404).json({ success: false, message: 'Series not found' });
    }
    const activeDirective = await SeriesSubmission.exists({
      seriesId,
      submissionType: 'POST_DECISION',
      decisionStatus: { $in: ['PENDING', 'TIE_BREAK_REQUIRED'] },
    });
    if (activeDirective) {
      return res.status(409).json({
        success: false,
        message: 'This series already has an active directive vote',
      });
    }

    let boardMembers = [];
    if (autoAssign || !voterIds) {
      // Random assignment: pick 4 board members automatically
      boardMembers = await pickRandomBoardMembers(4);
      if (boardMembers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No eligible BOARD_MEMBER users available for random assignment',
        });
      }
    } else {
      const uniqueVoterIds = [...new Set(voterIds.map((id) => id.toString()))];
      if (uniqueVoterIds.some((id) => !mongoose.isValidObjectId(id))) {
        return res.status(400).json({ success: false, message: 'One or more voterIds are invalid' });
      }
      const voterQuery = {
        role: 'BOARD_MEMBER',
        isActive: { $ne: false },
        deletedAt: null,
        _id: { $in: uniqueVoterIds },
      };
      const found = await User.find(voterQuery).select('_id');
      if (found.length !== uniqueVoterIds.length) {
        return res.status(400).json({
          success: false,
          message: 'All voters must be active BOARD_MEMBER users',
        });
      }
      boardMembers = found;
    }

    // Normalize: aggregate returns ObjectIds; find() returns documents.
    // Ensure every element is a document-shaped object `{ _id }`.
    boardMembers = boardMembers.map((m) => (
      m && typeof m === 'object' && m._id
        ? m
        : { _id: m }
    ));
    if (boardMembers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All voters must be active BOARD_MEMBER users',
      });
    }

    let selectedChairpersonId = chairpersonId;
    if (!selectedChairpersonId && req.user.role === 'BOARD_MEMBER') {
      const requesterIsVoter = boardMembers.some(
        (member) => member._id.toString() === req.user._id.toString(),
      );
      if (requesterIsVoter) selectedChairpersonId = req.user._id;
    }
    if (!selectedChairpersonId) selectedChairpersonId = boardMembers[0]._id;
    const chairIsVoter = boardMembers.some(
      (member) => member._id.toString() === selectedChairpersonId.toString(),
    );
    if (!chairIsVoter) {
      return res.status(400).json({
        success: false,
        message: 'chairpersonId must be one of the selected voters',
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
      votingDeadline: deadlineFromNow(),
      chairpersonId: selectedChairpersonId,
      requiredVoters: boardMembers.map((member) => ({
        userId: member._id,
        hasVoted: false,
        voteId: null,
      })),
    });

    const populated = await populateDirective(SeriesSubmission.findById(submission._id));
    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Created Directive',
      series.title,
      `${actionType}; Directive ID: ${submission._id}`,
    );
    if (req.io) req.io.emit('directive_created', populated);
    return res.status(201).json({ success: true, data: await toDirective(populated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.voteDirective = async (req, res) => {
  try {
    const { decision, comment } = req.body || {};
    if (!VOTE_DECISIONS.includes(decision)) {
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
      return res.status(409).json({ success: false, message: 'Directive is not open for voting' });
    }
    if (isOverdue(submission)) {
      await evaluateDirective(req, submission);
      return res.status(409).json({ success: false, message: 'Voting deadline has passed' });
    }

    const entry = submission.requiredVoters.find(
      (item) => item.userId.toString() === req.user._id.toString(),
    );
    if (!entry) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this vote' });
    }
    if (entry.hasVoted) {
      return res.status(409).json({ success: false, message: 'You already voted on this directive' });
    }

    const vote = await Vote.create({
      submissionId: submission._id,
      voterId: req.user._id,
      decision,
      comment: comment?.trim() || '',
    });
    entry.hasVoted = true;
    entry.voteId = vote._id;
    await submission.save();

    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Submitted Directive Vote',
      `Directive ID: ${submission._id}`,
      `Decision: ${decision}`,
    );
    await evaluateDirective(req, submission);

    const populated = await populateDirective(SeriesSubmission.findById(submission._id));
    if (req.io) req.io.emit('directive_voted', { directiveId: submission._id });
    return res.status(201).json({ success: true, data: await toDirective(populated) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'You already voted on this directive' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.tieBreakDirective = async (req, res) => {
  try {
    const { decision, comment } = req.body || {};
    if (!VOTE_DECISIONS.includes(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid tie-break decision' });
    }

    const submission = await SeriesSubmission.findOne({
      _id: req.params.directiveId,
      submissionType: 'POST_DECISION',
    });
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Directive not found' });
    }
    if (submission.decisionStatus !== 'TIE_BREAK_REQUIRED') {
      return res.status(409).json({ success: false, message: 'This directive does not require a tie-break' });
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

    await finalizeDirective(req, submission, decision, comment, req.user._id);
    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Broke Directive Tie',
      `Directive ID: ${submission._id}`,
      `Decision: ${decision}`,
    );

    const populated = await populateDirective(SeriesSubmission.findById(submission._id));
    return res.status(200).json({ success: true, data: await toDirective(populated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
