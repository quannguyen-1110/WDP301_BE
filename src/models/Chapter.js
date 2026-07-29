const mongoose = require("mongoose");

const CHAPTER_STATUS = [
  "IN_PROGRESS",
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "SENT_TO_EDITORIAL",
  "COMPLETED",
  "PUBLISHED",
  "ARCHIVED",
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

    // BE lưu thật trong DB
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

// Virtual để FE đọc được field "deadline"
chapterSchema.virtual("deadline").get(function () {
  if (!this.dueAt) return "";

  return this.dueAt.toISOString().split("T")[0];
});

// Cho phép virtual xuất ra JSON
chapterSchema.set("toJSON", {
  virtuals: true,
});

chapterSchema.set("toObject", {
  virtuals: true,
});

module.exports = mongoose.model("Chapter", chapterSchema);