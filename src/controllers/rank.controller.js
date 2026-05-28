import SeriesRank from "../models/series_rank.model.js";

export const submitRank = async (req, res) => {
  const rank = await SeriesRank.create(req.body);
  req.io.emit("rank_created", rank); // realtime
  res.json(rank);
};

export const getRank = async (rankId) => {
  const rank = await SeriesRank.findById(rankId);
  return rank;
};

export const updateRank = async (req, res) => {
  const rank = await SeriesRank.findByIdAndUpdate(req.params.id, req.body);
  res.json(rank);
};

export const deleteRank = async (req, res) => {
  const rank = await SeriesRank.findByIdAndDelete(req.params.id);
  res.json(rank);
};

export const getSeriesRanks = async (seriesId) => {
  const ranks = await SeriesRank.find({
    seriesId,
  })
    .sort({ createdAt: -1 })
    .limit(1);
  return ranks;
};

export const getGlobalRanks = async () => {
  const ranks = await SeriesRank.find({}).sort({ score: -1 }).limit(10);
  return ranks;
};
