const mongoose = require("mongoose");

const NOTIFICATION_TYPE = {
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
};

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPE),
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    // ===== Deep-link redirect fields =====
    // Friendly route path to navigate to when the user clicks the notification.
    link: {
      type: String,
      default: "",
    },
    // What kind of entity this notification refers to.
    targetType: {
      type: String,
      enum: ["PROPOSAL", "CHAPTER", "SERIES", "TASK", "ASSIGNMENT", "FEEDBACK", null],
      default: null,
    },
    // ID of the target entity (proposalId / chapterId / seriesId / taskId).
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    // ===== Extended references (Feedback / Assignment) =====
    feedbackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feedback",
      default: null,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
module.exports.NOTIFICATION_TYPE = NOTIFICATION_TYPE;
