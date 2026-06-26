const mongoose = require('mongoose');

const TASK_STATUS = [
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REVISION_REQUESTED',
];

const taskSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
      required: true,
    },

    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: String,

    pageIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Page',
      },
    ],

    // ===== Canvas Region =====
    regions: [
  {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    type: {
      type: String,
      default: 'TASK_ZONE',
    },
    comment: {
      type: String,
      default: '',
    },
  },
],

    status: {
      type: String,
      enum: TASK_STATUS,
      default: 'PENDING',
    },

    submittedAt: Date,

    reviewNote: String,

    reviewedAt: Date,

    dueAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Task', taskSchema);
module.exports.TASK_STATUS = TASK_STATUS;