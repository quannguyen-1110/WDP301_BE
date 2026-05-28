import Chapter from "../models/chapter.model.js";
import { CHAPTER_STATUS } from "../types/enum.type.js";

export const createChapter = async (req, res) => {
  const chapter = await Chapter.create(req.body);
  res.json(chapter);
};

export const getChapter = async (chapterId) => {
  const chapter = await Chapter.findById(chapterId);
  return chapter;
};

export const updateChapter = async (req, res) => {
  const chapter = await Chapter.findByIdAndUpdate(req.params.id, req.body);
  res.json(chapter);
};

export const deleteChapter = async (req, res) => {
  const chapter = await Chapter.findByIdAndDelete(req.params.id);
  res.json(chapter);
};

export const publishChapter = async (chapterId, req) => {
  const chapter = await Chapter.findByIdAndUpdate(chapterId, {
    status: CHAPTER_STATUS.COMPLETED,
  });
  req.io.emit("chapter_published", chapter);
  return chapter;
};
