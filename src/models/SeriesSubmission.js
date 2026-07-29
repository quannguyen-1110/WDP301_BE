const mongoose = require('mongoose');

const SUBMISSION_TYPE = ['PITCH', 'POST_DECISION', 'CHANGE_EDITOR', 'PUBLICATION_REVIEW'];
const ACTION_TYPE = [
  'APPROVE_WEEKLY',
  'APPROVE_MONTHLY',
  'CONTINUE',
  'CANCEL',
  'CHANGE_FORMAT',
  'PUBLISH',
  'REJECT',
  'RESCHEDULE',
];
const DECISION_STATUS = ['PENDING', 'TIE_BREAK_REQUIRED', 'APPROVED', 'REJECTED'];

const requiredVoterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    hasVoted: {
      type: Boolean,
      default: false,
    },
    voteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vote',
      default: null,
    },
  },
  { _id: false },
);

const seriesSubmissionSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
      default: null
    },
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SeriesProposal',
      default: null,
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      default: null,
    },
    submissionType: {
      type: String,
      enum: SUBMISSION_TYPE,
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ACTION_TYPE,
    },
    decisionStatus: {
      type: String,
      enum: DECISION_STATUS,
      default: 'PENDING',
    },
    requiredVoters: {
      type: [requiredVoterSchema],
      default: [],
    },
    chairpersonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    tiedDecisions: {
      type: [String],
      default: [],
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    newSchedule: {
      type: String,
      enum: ['WEEKLY', 'MONTHLY', null],
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SeriesSubmission', seriesSubmissionSchema);
module.exports.SUBMISSION_TYPE = SUBMISSION_TYPE;
module.exports.ACTION_TYPE = ACTION_TYPE;
module.exports.DECISION_STATUS = DECISION_STATUS;
