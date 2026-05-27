import mongoose from "mongoose";

const chapterSchema = new mongoose.Schema({
  seriesId: String,
  title: String
}, { timestamps: true });

export default mongoose.model("Chapter", chapterSchema);