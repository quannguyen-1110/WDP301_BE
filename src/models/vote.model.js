import mongoose from "mongoose";

import { VOTE_DECISION } from "../types/enum.type.js";

const voteSchema = new mongoose.Schema(
  {
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      required: true,
    },
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    decision: {
      type: String,
      enum: Object.values(VOTE_DECISION),
      default: VOTE_DECISION.ACCEPT,
    },
    comment: String,
  },
  { timestamps: true },
);

export default mongoose.model("Vote", voteSchema);
