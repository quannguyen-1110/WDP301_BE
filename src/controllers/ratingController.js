const Rating = require('../models/Rating.js');
const SeriesRank = require('../models/SeriesRank.js');
const mongoose = require('mongoose');

const updateMonthlyRank = async (seriesId) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  );

  // Calculate total voteCount for this series this month
  const [currentSeriesAgg] = await Rating.aggregate([
    {
      $match: {
        seriesId: new mongoose.Types.ObjectId(seriesId),
        createdAt: { $gte: startOfMonth, $lt: startOfNextMonth },
      },
    },
    { $group: { _id: null, totalVoteCount: { $sum: '$voteCount' } } },
  ]);

  if (!currentSeriesAgg) {
    return; // No ratings this month for this series
  }

  // Aggregate total voteCount per series for this month, sorted descending
  const seriesScores = await Rating.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lt: startOfNextMonth },
      },
    },
    { $group: { _id: '$seriesId', totalVoteCount: { $sum: '$voteCount' } } },
    { $sort: { totalVoteCount: -1 } },
  ]);

  // Find the rank (1-based) of the current series
  const rankIndex = seriesScores.findIndex(
    (s) => s._id.toString() === seriesId.toString()
  );

  if (rankIndex === -1) return;

  const newRank = rankIndex + 1;

  // Find existing rank entry for this series in the current month
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

exports.submitRating = async (req, res) => {
  try {
    const rating = await Rating.create(req.body);
    req.io.emit('rating_created', rating); // realtime

    // Update monthly rank based on voteCount
    await updateMonthlyRank(rating.seriesId);

    res.status(201).json({
      success: true,
      data: rating,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateRating = async (req, res) => {
  try {
    const rating = await Rating.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({
      success: true,
      data: rating,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteRating = async (req, res) => {
  try {
    const rating = await Rating.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      data: rating,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getMyRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ submittedBy: req.query.userId });
    res.status(200).json({
      success: true,
      data: ratings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSeriesRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ seriesId: req.params.seriesId });
    res.status(200).json({
      success: true,
      data: ratings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};