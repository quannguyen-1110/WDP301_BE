const mongoose = require('mongoose');

const TASK_STATUS = [
  'PENDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'MANGAKA_APPROVED',
  'APPROVED',
  'REVISION_REQUESTED',
  'REVISING',
  'COMPLETED',
  'ASSIGNED',
  'PENDING_REVIEW',
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

    type: {
      type: String,
      enum: ['Background', 'Character', 'Effects', 'Lettering', 'Toning'],
      default: 'Background',
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
          default: 'Background',
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

    reviewHistory: [
      {
        reviewerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        reviewerRole: {
          type: String,
          enum: ['MANGAKA', 'EDITOR', 'ADMIN'],
          required: true,
        },
        action: {
          type: String,
          enum: ['APPROVE', 'REVISION_REQUESTED'],
          required: true,
        },
        note: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    dueAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Task', taskSchema);
module.exports.TASK_STATUS = TASK_STATUS;