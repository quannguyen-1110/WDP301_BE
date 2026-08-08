const mongoose = require("mongoose");

const ASSIGNMENT_STATUS = [
  "ASSIGNED",      // Mangaka vừa mời assistant
  "IN_PROGRESS",   // Assistant bắt đầu làm
  "SUBMITTED",     // Assistant hoàn thành, chờ mangaka review
  "COMPLETED",     // Mangaka xác nhận xong, gửi lại editor
];

const assignmentSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Series",
      required: true,
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
    },
    assistantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Liên kết feedback mà assignment này giải quyết (nếu có)
    feedbackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feedback",
      default: null,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ASSIGNMENT_STATUS,
      default: "ASSIGNED",
    },
    submittedAt: Date,
    completedAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Assignment", assignmentSchema);
module.exports.ASSIGNMENT_STATUS = ASSIGNMENT_STATUS;
