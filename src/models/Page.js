const mongoose = require("mongoose");

const PAGE_STATUS = ["DRAFT", "HAS_TASK", "IN_PROGRESS", "COMPLETED", "APPROVED", "REVISION_REQUESTED"];

const pageSchema = new mongoose.Schema(
  {
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
    },
    pageNumber: Number,
    imageUrl: String,
    assistantImageUrl: {
      type: String,
      default: '',
    },
    resources: [{
      name: String,
      url: String,
      description: String,
    }],
    status: {
      type: String,
      enum: PAGE_STATUS,
      default: "DRAFT",
    },
    note: String,
    reviewNote: String,
    approvedAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Page", pageSchema);
module.exports.PAGE_STATUS = PAGE_STATUS;
