const mongoose = require('mongoose');

const VOTE_DECISION = ['ACCEPT', 'REJECT'];

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
    comment: String,
  },
  { timestamps: true },
);

voteSchema.index({ submissionId: 1, voterId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);