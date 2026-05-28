const mongoose = require('mongoose');

const seriesRankSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
      required: true,
    },
    rank: {
      type: Number,
      required: true,
    },
    prevRank: Number,
    rankedOn: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SeriesRank', seriesRankSchema);