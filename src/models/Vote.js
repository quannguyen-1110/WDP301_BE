const mongoose = require('mongoose');

const VOTE_DECISION = ['ACCEPT', 'REJECT'];

const voteSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Submission',
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
      default: VOTE_DECISION[0],
    },
    comment: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model('Vote', voteSchema);