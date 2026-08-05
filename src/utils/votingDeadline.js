// Shared voting-deadline helpers for SeriesSubmission voting sessions.
// A session's votingDeadline is set when the session is created. Once the
// deadline passes, votes/tie-breaks are no longer accepted and the session is
// auto-finalized from the votes cast so far.

const DEFAULT_VOTING_DEADLINE_DAYS = 7;

const deadlineFromNow = (days = DEFAULT_VOTING_DEADLINE_DAYS) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const isOverdue = (submission) => {
  if (!submission || !submission.votingDeadline) return false;
  return new Date() > new Date(submission.votingDeadline);
};

module.exports = {
  DEFAULT_VOTING_DEADLINE_DAYS,
  deadlineFromNow,
  isOverdue,
};
