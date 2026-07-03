const mongoose = require('mongoose');

const SUBMISSION_TYPE = ['PITCH', 'POST_DECISION', 'CHANGE_EDITOR'];
const ACTION_TYPE = ['APPROVE_WEEKLY', 'APPROVE_MONTHLY', 'CANCEL', 'CHANGE_FORMAT'];
const DECISION_STATUS = ['PENDING', 'APPROVED', 'REJECTED'];

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
    },
    requiredVoters: {
      type: [requiredVoterSchema],
      default: [],
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SeriesSubmission', seriesSubmissionSchema);