const mongoose = require('mongoose');

const SUBMISSION_TYPE = ['PITCH', 'POST_DECISION', 'CHANGE_EDITOR'];
const ACTION_TYPE = ['APPROVE_WEEKLY', 'APPROVE_MONTHLY', 'CANCEL', 'CHANGE_FORMAT'];
const DECISION_STATUS = ['PENDING', 'APPROVED', 'REJECTED'];

const seriesSubmissionSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
      required: true,
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
      required: true,
    },
    decisionStatus: {
      type: String,
      enum: DECISION_STATUS,
      required: true,
      default: 'PENDING',
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SeriesSubmission', seriesSubmissionSchema);