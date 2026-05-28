import mongoose from "mongoose";

import { CHAPTER_STATUS } from "../types/enum.type.js";

const chapterSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Series",
      required: true,
    },
    chapterNumber: Number,
    status: {
      type: String,
      enum: Object.values(CHAPTER_STATUS),
      default: CHAPTER_STATUS.IN_PROGRESS,
    },
    dueAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model("Chapter", chapterSchema);
