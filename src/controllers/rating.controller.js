import Rating from "../models/rating.model.js";
import SeriesRank from "../models/series_rank.model.js";
import mongoose from "mongoose";

const updateMonthlyRank = async (seriesId) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  );

  const [currentSeriesAgg] = await Rating.aggregate([
    {
      $match: {
        seriesId: new mongoose.Types.ObjectId(seriesId),
        createdAt: { $gte: startOfMonth, $lt: startOfNextMonth },
      },
    },
    { $group: { _id: null, totalVoteCount: { $sum: "$voteCount" } } },
  ]);

  if (!currentSeriesAgg) {
    return;
  }

  const seriesScores = await Rating.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lt: startOfNextMonth },
      },
    },
    { $group: { _id: "$seriesId", totalVoteCount: { $sum: "$voteCount" } } },
    { $sort: { totalVoteCount: -1 } },
  ]);

  const rankIndex = seriesScores.findIndex(
    (s) => s._id.toString() === seriesId.toString()
  );

  if (rankIndex === -1) return;

  const newRank = rankIndex + 1;

  const existingRank = await SeriesRank.findOne({
    seriesId,
    rankedOn: { $gte: startOfMonth, $lt: startOfNextMonth },
  });

  if (existingRank) {
    existingRank.prevRank = existingRank.rank;
    existingRank.rank = newRank;
    await existingRank.save();
  } else {
    await SeriesRank.create({
      seriesId,
      rank: newRank,
      prevRank: null,
      rankedOn: now,
    });
  }
};

export const submitRating = async (req, res) => {
  const rating = await Rating.create(req.body);
  req.io.emit("rating_created", rating); // realtime

  await updateMonthlyRank(rating.seriesId);

  res.json(rating);
};

export const getRating = async (ratingId) => {
  const rating = await Rating.findById(ratingId);
  return rating;
};

export const updateRating = async (req, res) => {
  const rating = await Rating.findByIdAndUpdate(req.params.id, req.body);
  res.json(rating);
};

export const deleteRating = async (req, res) => {
  const rating = await Rating.findByIdAndDelete(req.params.id);
  res.json(rating);
};

export const getSeriesRatings = async (seriesId) => {
  const ratings = await Rating.find({ seriesId });
  return ratings;
};