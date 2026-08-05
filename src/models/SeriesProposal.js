const mongoose = require('mongoose');

const PROPOSAL_STATUS = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'REVISION_REQUESTED',
  'RESUBMITTED',
  'APPROVED_BY_TANTOU',
  'SENT_TO_EDITORIAL_BOARD',
  'APPROVED',
  'SERIES_CREATED',
  'REJECTED',
];

const commentSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    authorRole: {
      type: String,
      enum: ['editor', 'mangaka', 'board'],
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
    },
    isInternal: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const seriesProposalSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    genre: {
      type: String,
      required: [true, 'Genre is required'],
      trim: true,
    },
    synopsis: {
      type: String,
      required: [true, 'Synopsis is required'],
      trim: true,
    },
    storyboardUrl: {
      type: String,
      default: '',
    },
    storyboardPath: {
      type: String,
      default: '',
    },
    storyboardOriginalName: {
      type: String,
      default: '',
    },
    storyboardImages: [{
      url: { type: String, required: true },
      originalName: { type: String, required: true },
    }],
    status: {
      type: String,
      enum: PROPOSAL_STATUS,
      default: 'SUBMITTED',
    },
    mangakaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Mangaka ID is required'],
    },
    // When set to true (upon forwarding to board), the author identity is
    // hidden from board members (blind review / anonymous judging).
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    comments: {
      type: [commentSchema],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SeriesProposal', seriesProposalSchema);
module.exports.PROPOSAL_STATUS = PROPOSAL_STATUS;