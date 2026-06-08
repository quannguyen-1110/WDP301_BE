const mongoose = require("mongoose");

const CHAPTER_STATUS = [
  "IN_PROGRESS",
  "COMPLETED",
];

const chapterSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Series",
      required: true,
    },

    chapterNumber: {
      type: Number,
      required: true,
    },

    title: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: CHAPTER_STATUS,
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

    totalPages: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Chapter", chapterSchema);