const mongoose = require("mongoose");

const FEEDBACK_STATUS = [
  "OPEN",          // Editor đã gửi, chưa ai xử lý
  "IN_PROGRESS",   // Mangaka đã giao cho assistant đang sửa
  "RESOLVED",      // Assistant đã sửa xong, mangaka gửi lại editor
  "APPROVED",      // Editor đồng ý, đóng feedback
];

const feedbackSchema = new mongoose.Schema(
  {
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
      index: true,
    },
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Series",
      required: true,
    },
    editorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      required: [true, "Feedback message is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: FEEDBACK_STATUS,
      default: "OPEN",
    },
    version: {
      type: Number,
      default: 1,
    },
    // Liên kết tới assignment mà mangaka tạo để xử lý feedback này
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      default: null,
    },
    // Lịch sử các lần sửa (assistant trả kết quả)
    revisionHistory: [
      {
        assignmentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Assignment",
        },
        note: String,
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
module.exports.FEEDBACK_STATUS = FEEDBACK_STATUS;
