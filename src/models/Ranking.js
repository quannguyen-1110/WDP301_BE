const mongoose = require('mongoose');

const rankingSchema = new mongoose.Schema(
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
    prevRank: {
      type: Number,
      default: null,
    },
    votes: {
      type: Number,
      default: 0,
    },
    ratingScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    trend: {
      type: String,
      enum: ['up', 'down', 'flat'],
      default: 'flat',
    },
    directive: {
      type: String,
      enum: ['axed', 'digital', null],
      default: null,
    },
    cycle: {
      type: String,
      enum: ['weekly', 'monthly'],
      required: true,
    },
    cycleStart: {
      type: Date,
      required: true,
    },
    cycleEnd: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

// Compound index to ensure one entry per series per cycle
rankingSchema.index({ seriesId: 1, cycle: 1, cycleStart: 1 }, { unique: true });
// Index for leaderboard queries
rankingSchema.index({ cycle: 1, cycleStart: 1, rank: 1 });

module.exports = mongoose.model('Ranking', rankingSchema);