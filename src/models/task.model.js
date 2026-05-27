import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  seriesId: String,
  chapterId: String,
  assignedTo: String, // userId
  title: String,
  status: {
    type: String,
    enum: ["PENDING", "DONE"],
    default: "PENDING"
  }
}, { timestamps: true });

export default mongoose.model("Task", taskSchema);