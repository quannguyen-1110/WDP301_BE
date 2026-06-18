const mongoose = require('mongoose');

const DEFENSE_REPORT_STATUS = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'];

const defenseReportSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
      required: [true, 'Series ID is required'],
    },
    editorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Editor ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    defenseArguments: {
      type: String,
      default: '',
    },
    metrics: {
      totalChapters: {
        type: Number,
        default: 0,
      },
      totalVotes: {
        type: Number,
        default: 0,
      },
      currentRank: {
        type: Number,
        default: null,
      },
      readerGrowth: {
        type: String,
        default: '',
      },
    },
    improvementPlan: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: DEFENSE_REPORT_STATUS,
      default: 'DRAFT',
    },
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
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DefenseReport', defenseReportSchema);
module.exports.DEFENSE_REPORT_STATUS = DEFENSE_REPORT_STATUS;
