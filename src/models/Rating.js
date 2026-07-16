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
      min: 0,
    },
    cycle: {
      type: String,
      enum: ['WEEKLY', 'MONTHLY'],
      required: true,
      default: 'MONTHLY',
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    ratingScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    readerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    revenue: {
      type: Number,
      default: null,
      min: 0,
    },
    sourceFrom: {
      type: String,
      trim: true,
      default: 'MANUAL',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

ratingSchema.index(
  { seriesId: 1, cycle: 1, periodStart: 1, sourceFrom: 1 },
  {
    unique: true,
    partialFilterExpression: {
      periodStart: { $type: 'date' },
      sourceFrom: { $type: 'string' },
    },
  },
);

module.exports = mongoose.model('Rating', ratingSchema);