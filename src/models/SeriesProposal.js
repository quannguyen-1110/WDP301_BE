const mongoose = require('mongoose');

const PROPOSAL_STATUS = ['PENDING', 'FORWARDED', 'REJECTED'];

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
      required: [true, 'Storyboard filesystem path is required'],
    },
    storyboardOriginalName: {
      type: String,
      required: [true, 'Storyboard original name is required'],
    },
    status: {
      type: String,
      enum: PROPOSAL_STATUS,
      default: 'PENDING',
    },
    mangakaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Mangaka ID is required'],
    },
    comment: {
      type: String,
      default: '',
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
