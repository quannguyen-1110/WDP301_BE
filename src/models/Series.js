const mongoose = require('mongoose');

// Status thống nhất chung cho toàn team
const SERIES_STATUS = [
  'PENDING',
  'APPROVED',
  'ACTIVE',
  'ON_HIATUS',
  'IN_PRODUCTION',
  'PUBLISHED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];
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
    genre: {
      type: String,
      trim: true,
      default: 'Drama',
    },
    tags: {
      type: [String],
      default: [],
    },
    originalTitle: {
      type: String,
      trim: true,
      default: '',
    },
    localizedTitle: {
      type: String,
      trim: true,
      default: '',
    },
    originalAuthor: {
      type: String,
      trim: true,
      default: '',
    },
    publicationYear: {
      type: Number,
      default: null,
    },
    isCatalogFeatured: {
      type: Boolean,
      default: false,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    bannerUrl: {
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
    editorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SeriesProposal',
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
seriesSchema.index(
  { proposalId: 1 },
  {
    unique: true,
    partialFilterExpression: { proposalId: { $type: 'objectId' } },
  },
);


module.exports = mongoose.model('Series', seriesSchema);
module.exports.SERIES_STATUS = SERIES_STATUS;
module.exports.PUBLICATION_SCHEDULE = PUBLICATION_SCHEDULE;
