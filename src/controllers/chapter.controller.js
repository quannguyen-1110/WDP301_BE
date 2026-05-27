import Chapter from "../models/chapter.model.js";

export const createChapter = async (req, res) => {
  const chapter = await Chapter.create(req.body);
  res.json(chapter);
};