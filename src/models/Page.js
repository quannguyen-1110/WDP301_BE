const mongoose = require("mongoose");

const PAGE_STATUS = ["DRAFT", "HAS_TASK", "COMPLETED"];

const pageSchema = new mongoose.Schema(
  {
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
    },
    pageNumber: Number,
    imageUrl: String,
    status: {
      type: String,
      enum: PAGE_STATUS,
      default: "DRAFT",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Page", pageSchema);
