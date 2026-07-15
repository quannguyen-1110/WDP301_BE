const mongoose = require('mongoose');

const PROPOSAL_STATUS = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'REVISION_REQUESTED',
  'RESUBMITTED',
  'APPROVED_BY_TANTOU',
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
      required: [true, 'Storyboard URL is required'],
    },
    storyboardPath: {
      type: String,
      default: '',
    },
    storyboardOriginalName: {
      type: String,
      required: [true, 'Storyboard original name is required'],
    },
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
    comments: {
      type: [commentSchema],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SeriesProposal', seriesProposalSchema);
module.exports.PROPOSAL_STATUS = PROPOSAL_STATUS;