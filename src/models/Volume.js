const mongoose = require("mongoose");

const VOLUME_STATUS = [
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "COMPLETED",
  "PUBLISHED",
  "ARCHIVED",
];

const volumeSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Series",
      required: true,
      index: true,
    },
    volumeNumber: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: VOLUME_STATUS,
      default: "IN_PROGRESS",
    },
    dueAt: {
      type: Date,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    totalChapters: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Volume", volumeSchema);
module.exports.VOLUME_STATUS = VOLUME_STATUS;
