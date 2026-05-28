const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
      required: true,
    },
    voteCount: {
      type: Number,
      default: 0,
    },
    sourceFrom: String,
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rating', ratingSchema);