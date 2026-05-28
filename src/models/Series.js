const mongoose = require('mongoose');

// Status thống nhất chung cho toàn team
const SERIES_STATUS = ['PENDING', 'APPROVED', 'IN_PRODUCTION', 'PUBLISHED', 'REJECTED', 'CANCELLED'];
const PUBLICATION_SCHEDULE = ['WEEKLY', 'MONTHLY'];

const seriesSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    synopsis: {
      type: String,
      default: '',
    },
    mangakaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Mangaka ID is required'],
    },
    status: {
      type: String,
      enum: SERIES_STATUS,
      default: 'PENDING',
    },
    pubSchedule: {
      type: String,
      enum: PUBLICATION_SCHEDULE,
      default: null,
    },
    // Editor review fields
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNote: {
      type: String,
      default: '',
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Series', seriesSchema);
module.exports.SERIES_STATUS = SERIES_STATUS;
module.exports.PUBLICATION_SCHEDULE = PUBLICATION_SCHEDULE;
