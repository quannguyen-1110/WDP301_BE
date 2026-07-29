const mongoose = require('mongoose');
const Chapter = require('../models/Chapter');
const Task = require('../models/Task');
const Page = require('../models/Page');
const Series = require('../models/Series');
const SeriesSubmission = require('../models/SeriesSubmission');
const Vote = require('../models/Vote');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { logAction } = require('../utils/auditLogger');

const PUBLICATION_DECISIONS = ['PUBLISH', 'REJECT', 'RESCHEDULE'];
const ACTIVE_SESSION_STATUSES = ['PENDING', 'TIE_BREAK_REQUIRED'];

const tallyVotes = (votes, required) => ({
  PUBLISH: votes.filter((vote) => vote.decision === 'PUBLISH').length,
  REJECT: votes.filter((vote) => vote.decision === 'REJECT').length,
  RESCHEDULE: votes.filter((vote) => vote.decision === 'RESCHEDULE').length,
  total: votes.length,
  required,
});

const populateChapter = (query) => query.populate(
  'seriesId',
  '_id title mangakaId editorId pubSchedule',
);

const populateSession = (query) => query
  .populate('submittedBy', 'name role')
  .populate('chairpersonId', 'name role')
  .populate('requiredVoters.userId', 'name email role');

const getSessionPayload = async (chapter, session) => {
  const [votes, tasks, pages] = await Promise.all([
    session
      ? Vote.find({ submissionId: session._id })
        .populate('voterId', 'name email role')
        .sort({ createdAt: 1 })
      : [],
    Task.find({ chapterId: chapter._id })
      .select('title description status assignedTo assignedBy pageIds submittedAt reviewNote reviewedAt dueAt updatedAt')
      .populate('assignedTo', 'name email role')
      .populate('assignedBy', 'name email role')
      .sort({ createdAt: 1 }),
    Page.find({ chapterId: chapter._id })
      .select('pageNumber imageUrl assistantImageUrl status note reviewNote approvedAt updatedAt')
      .sort({ pageNumber: 1 }),
  ]);

  return {
    chapter,
    session: session || null,
    votes,
    tally: tallyVotes(votes, session?.requiredVoters.length || 0),
    tasks,
    pages,
    approvalEvidence: {
      taskCount: tasks.length,
      approvedTaskCount: tasks.filter((task) => task.status === 'APPROVED').length,
      pageCount: pages.length,
      approvedPageCount: pages.filter((page) => page.status === 'APPROVED').length,
    },
  };
};

const findPopulatedSession = (sessionId) => populateSession(
  SeriesSubmission.findById(sessionId),
);

const emitNotification = (req, notification) => {
  if (!req.io) return;
  req.io.to(notification.userId.toString()).emit('notification', notification);
};

const notifyPublicationOutcome = async (req, chapter, series, decision, comment) => {
  const recipientIds = [series.mangakaId, series.editorId]
    .filter(Boolean)
    .map((id) => id.toString());
  const uniqueRecipientIds = [...new Set(recipientIds)];
  if (uniqueRecipientIds.length === 0) return;

  const title = `Chapter publication decision: ${decision}`;
  const note = comment?.trim() ? ` Comment: ${comment.trim()}` : '';
  const content = `Chapter ${chapter.chapterNumber} of "${series.title}" received the ${decision} decision.${note}`;

  const notifications = await Notification.insertMany(
    uniqueRecipientIds.map((userId) => ({
      userId,
      title,
      content,
      type: decision === 'REJECT' ? 'WARNING' : 'INFO',
    })),
  );
  notifications.forEach((notification) => emitNotification(req, notification));
};

const resolveReschedule = (session, series) => {
  if (session.newSchedule) return session.newSchedule;
  return series.pubSchedule === 'WEEKLY' ? 'MONTHLY' : 'WEEKLY';
};

const applyPublicationDecision = async (req, session, decision, comment, decidedBy) => {
  const chapter = await Chapter.findById(session.chapterId);
  if (!chapter) throw new Error('Chapter not found while applying publication decision');

  const series = await Series.findById(session.seriesId);
  if (!series) throw new Error('Series not found while applying publication decision');
  const revisionReason = comment?.trim() || 'Revision requested by Editorial Board';

  if (decision === 'PUBLISH') {
    chapter.status = 'PUBLISHED';
    chapter.publishedAt = new Date();
    await chapter.save();
  } else if (decision === 'REJECT') {
    chapter.status = 'REVISION_REQUESTED';
    chapter.publishedAt = null;
    await Promise.all([
      chapter.save(),
      Task.updateMany(
        { chapterId: chapter._id, status: 'APPROVED' },
        {
          $set: {
            status: 'REVISION_REQUESTED',
            reviewNote: revisionReason,
            reviewedAt: new Date(),
          },
        },
      ),
      Page.updateMany(
        { chapterId: chapter._id, status: 'APPROVED' },
        {
          $set: {
            status: 'REVISION_REQUESTED',
            reviewNote: revisionReason,
            approvedAt: null,
          },
        },
      ),
    ]);
  } else {
    series.pubSchedule = resolveReschedule(session, series);
    await series.save();
    chapter.status = 'SENT_TO_EDITORIAL';
    await chapter.save();
  }

  session.action = decision;
  session.decisionStatus = decision === 'REJECT' ? 'REJECTED' : 'APPROVED';
  session.tiedDecisions = [];
  session.decidedBy = decidedBy;
  session.decidedAt = new Date();
  if (decision === 'REJECT') {
    session.reason = revisionReason;
  } else if (comment?.trim()) {
    session.reason = comment.trim();
  }
  await session.save();

  await notifyPublicationOutcome(req, chapter, series, decision, comment);
  await logAction(
    decidedBy,
    req.user.name || 'Editorial Board',
    'Publication Decision Made',
    `Chapter ID: ${chapter._id}`,
    `Decision: ${decision}; Session ID: ${session._id}`,
  );

  if (req.io) {
    req.io.emit('publication_decided', {
      chapterId: chapter._id,
      sessionId: session._id,
      decision,
    });
  }

  return populateChapter(Chapter.findById(chapter._id));
};

const evaluatePublicationSession = async (req, session) => {
  const voterIds = session.requiredVoters.map((entry) => entry.userId);
  const votes = await Vote.find({
    submissionId: session._id,
    voterId: { $in: voterIds },
  });
  const allVoted = session.requiredVoters.length > 0
    && session.requiredVoters.every((entry) => entry.hasVoted);
  if (!allVoted) return null;

  const tally = tallyVotes(votes, session.requiredVoters.length);
  const counts = PUBLICATION_DECISIONS.map((decision) => ({
    decision,
    count: tally[decision],
  }));
  const maxCount = Math.max(...counts.map((entry) => entry.count));
  const winners = counts
    .filter((entry) => entry.count === maxCount)
    .map((entry) => entry.decision);

  if (winners.length > 1) {
    session.decisionStatus = 'TIE_BREAK_REQUIRED';
    session.tiedDecisions = winners;
    await session.save();
    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Publication Tie Detected',
      `Session ID: ${session._id}`,
      `Tied decisions: ${winners.join(', ')}`,
    );

    if (session.chairpersonId) {
      const tieNotification = await Notification.create({
        userId: session.chairpersonId,
        title: 'Publication Tie-Break Required',
        content: `A tie occurred during publication review voting. As chairperson, your tie-break decision is required between: ${winners.join(', ')}.`,
        type: 'WARNING',
      });
      emitNotification(req, tieNotification);
    }
    return null;
  }

  const outcomeComment = votes
    .filter((vote) => vote.decision === winners[0] && vote.comment?.trim())
    .map((vote) => vote.comment.trim())
    .join(' | ');
  return applyPublicationDecision(
    req,
    session,
    winners[0],
    outcomeComment,
    req.user._id,
  );
};

exports.getPublications = async (req, res) => {
  try {
    const sessions = await populateSession(
      SeriesSubmission.find({ submissionType: 'PUBLICATION_REVIEW' })
        .sort({ createdAt: -1 }),
    );
    const latestSessionByChapter = new Map();
    sessions.forEach((session) => {
      if (!session.chapterId) return;
      const key = session.chapterId.toString();
      if (!latestSessionByChapter.has(key)) latestSessionByChapter.set(key, session);
    });

    const chapters = await populateChapter(
      Chapter.find({
        $or: [
          { status: 'SENT_TO_EDITORIAL' },
          { _id: { $in: [...latestSessionByChapter.keys()] } },
        ],
      }).sort({ updatedAt: -1 }),
    );

    const data = await Promise.all(chapters.map((chapter) => (
      getSessionPayload(chapter, latestSessionByChapter.get(chapter._id.toString()) || null)
    )));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.openPublication = async (req, res) => {
  try {
    const { chapterId } = req.params;
    const { newSchedule, voterIds, chairpersonId } = req.body || {};
    if (!mongoose.isValidObjectId(chapterId)) {
      return res.status(400).json({ success: false, message: 'Invalid chapterId' });
    }
    if (newSchedule && !['WEEKLY', 'MONTHLY'].includes(newSchedule)) {
      return res.status(400).json({ success: false, message: 'newSchedule must be WEEKLY or MONTHLY' });
    }
    if (voterIds !== undefined && (!Array.isArray(voterIds) || voterIds.length === 0)) {
      return res.status(400).json({ success: false, message: 'voterIds must be a non-empty array when provided' });
    }

    const chapter = await populateChapter(Chapter.findById(chapterId));
    if (!chapter) {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }
    if (chapter.status !== 'SENT_TO_EDITORIAL') {
      return res.status(409).json({
        success: false,
        message: 'Only chapters with SENT_TO_EDITORIAL status can enter publication review',
      });
    }

    const tasks = await Task.find({ chapterId }).select('status');
    if (tasks.length === 0 || tasks.some((task) => task.status !== 'APPROVED')) {
      return res.status(409).json({
        success: false,
        message: 'All chapter tasks must have final editor approval',
      });
    }

    const activeSession = await SeriesSubmission.exists({
      chapterId,
      submissionType: 'PUBLICATION_REVIEW',
      decisionStatus: { $in: ACTIVE_SESSION_STATUSES },
    });
    if (activeSession) {
      return res.status(409).json({ success: false, message: 'An active publication review already exists' });
    }

    const uniqueVoterIds = voterIds
      ? [...new Set(voterIds.map((id) => id.toString()))]
      : null;
    if (uniqueVoterIds?.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: 'One or more voterIds are invalid' });
    }

    const voterQuery = {
      role: 'BOARD_MEMBER',
      isActive: { $ne: false },
      deletedAt: null,
    };
    if (uniqueVoterIds) voterQuery._id = { $in: uniqueVoterIds };
    const voters = await User.find(voterQuery).select('_id');
    if (voters.length === 0 || (uniqueVoterIds && voters.length !== uniqueVoterIds.length)) {
      return res.status(400).json({
        success: false,
        message: 'All voters must be active BOARD_MEMBER users',
      });
    }

    let selectedChairpersonId = chairpersonId;
    if (!selectedChairpersonId && req.user.role === 'BOARD_MEMBER') {
      const requesterIsVoter = voters.some(
        (voter) => voter._id.toString() === req.user._id.toString(),
      );
      if (requesterIsVoter) selectedChairpersonId = req.user._id;
    }
    if (!selectedChairpersonId) selectedChairpersonId = voters[0]._id;
    const chairIsVoter = voters.some(
      (voter) => voter._id.toString() === selectedChairpersonId.toString(),
    );
    if (!chairIsVoter) {
      return res.status(400).json({ success: false, message: 'chairpersonId must be one of the selected voters' });
    }

    const session = await SeriesSubmission.create({
      seriesId: chapter.seriesId._id,
      chapterId: chapter._id,
      submissionType: 'PUBLICATION_REVIEW',
      submittedBy: req.user._id,
      decisionStatus: 'PENDING',
      newSchedule: newSchedule || null,
      chairpersonId: selectedChairpersonId,
      requiredVoters: voters.map((voter) => ({
        userId: voter._id,
        hasVoted: false,
        voteId: null,
      })),
    });

    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Opened Publication Review',
      `Chapter ID: ${chapter._id}`,
      `Session ID: ${session._id}; Required voters: ${voters.length}`,
    );

    const notifications = await Notification.insertMany(
      voters.map((voter) => ({
        userId: voter._id,
        title: 'New Publication Review Assigned',
        content: `You have been assigned to vote on publication review for Chapter ${chapter.chapterNumber} of "${chapter.seriesId?.title || 'Series'}".`,
        type: 'INFO',
      })),
    );
    notifications.forEach((notification) => emitNotification(req, notification));

    if (req.io) req.io.emit('publication_review_opened', { chapterId, sessionId: session._id });

    const populatedSession = await findPopulatedSession(session._id);
    return res.status(201).json({
      success: true,
      data: await getSessionPayload(chapter, populatedSession),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.votePublication = async (req, res) => {
  try {
    const { decision, comment } = req.body || {};
    if (!PUBLICATION_DECISIONS.includes(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid publication decision' });
    }
    if (['REJECT', 'RESCHEDULE'].includes(decision) && !comment?.trim()) {
      return res.status(400).json({
        success: false,
        message: `A comment is required when decision is ${decision}`,
      });
    }

    const session = await SeriesSubmission.findOne({
      _id: req.params.sessionId,
      submissionType: 'PUBLICATION_REVIEW',
    });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Publication review session not found' });
    }
    if (session.decisionStatus !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'This publication review is not open for voting' });
    }

    const voterEntry = session.requiredVoters.find(
      (entry) => entry.userId.toString() === req.user._id.toString(),
    );
    if (!voterEntry) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this publication vote' });
    }
    if (voterEntry.hasVoted) {
      return res.status(409).json({ success: false, message: 'You have already voted on this publication review' });
    }

    const vote = await Vote.create({
      submissionId: session._id,
      voterId: req.user._id,
      decision,
      comment: comment?.trim() || '',
    });
    voterEntry.hasVoted = true;
    voterEntry.voteId = vote._id;
    await session.save();

    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Submitted Publication Vote',
      `Session ID: ${session._id}`,
      `Decision: ${decision}`,
    );

    await evaluatePublicationSession(req, session);
    const [chapter, populatedSession] = await Promise.all([
      populateChapter(Chapter.findById(session.chapterId)),
      findPopulatedSession(session._id),
    ]);

    return res.status(201).json({
      success: true,
      data: await getSessionPayload(chapter, populatedSession),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'You have already voted on this publication review' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.tieBreakPublication = async (req, res) => {
  try {
    const { decision, comment } = req.body || {};
    if (!PUBLICATION_DECISIONS.includes(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid publication decision' });
    }
    if (['REJECT', 'RESCHEDULE'].includes(decision) && !comment?.trim()) {
      return res.status(400).json({
        success: false,
        message: `A comment is required when decision is ${decision}`,
      });
    }

    const session = await SeriesSubmission.findOne({
      _id: req.params.sessionId,
      submissionType: 'PUBLICATION_REVIEW',
    });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Publication review session not found' });
    }
    if (session.decisionStatus !== 'TIE_BREAK_REQUIRED') {
      return res.status(409).json({ success: false, message: 'This session does not require a tie-break' });
    }

    const isChairperson = session.chairpersonId
      && session.chairpersonId.toString() === req.user._id.toString();
    if (req.user.role !== 'ADMIN' && !isChairperson) {
      return res.status(403).json({ success: false, message: 'Only the chairperson or an admin can break this tie' });
    }
    if (!session.tiedDecisions.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'The tie-break decision must be one of the tied decisions',
      });
    }

    const chapter = await applyPublicationDecision(
      req,
      session,
      decision,
      comment,
      req.user._id,
    );
    const populatedSession = await findPopulatedSession(session._id);
    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Broke Publication Tie',
      `Session ID: ${session._id}`,
      `Decision: ${decision}`,
    );

    return res.status(200).json({
      success: true,
      data: await getSessionPayload(chapter, populatedSession),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
