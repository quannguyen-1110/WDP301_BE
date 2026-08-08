const mongoose = require('mongoose');

const VOTE_DECISION = [
  'ACCEPT',
  'REJECT',
  'PUBLISH',
  'RESCHEDULE',
];

const voteSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SeriesSubmission',
      required: true,
    },
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    decision: {
      type: String,
      enum: VOTE_DECISION,
      required: true,
    },
    // Preferred publication schedule when ACCEPT/PUBLISH is chosen
    schedule: {
      type: String,
      enum: ['WEEKLY', 'MONTHLY', null],
      default: null,
    },
    comment: String,
  },
  { timestamps: true },
);

voteSchema.index({ submissionId: 1, voterId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
module.exports.VOTE_DECISION = VOTE_DECISION;