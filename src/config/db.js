import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/manga_demo");
    console.log("MongoDB connected");
  } catch (err) {
    console.error(err);
  }
};