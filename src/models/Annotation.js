const mongoose = require("mongoose");

const ANNOTATION_TYPE = [
  "DIALOGUE_ISSUE",
  "CONTENT",
  "SCRIPT",
  "DIALOGUE",
  "STORY_ISSUE",
  "SCRIPT_REVISION",
  "CONTENT_CORRECTION",
  "SCENE_IMPROVEMENT",
  "GENERAL_FEEDBACK",
];

const annotationSchema = new mongoose.Schema(
  {
    pageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Page",
      required: true,
    },
    annotatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coords: {
      type: JSON,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ANNOTATION_TYPE,
      required: true,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Annotation", annotationSchema);
