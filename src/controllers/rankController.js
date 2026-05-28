const SeriesRank = require('../models/SeriesRank.js');

exports.submitRank = async (req, res) => {
  try {
    const rank = await SeriesRank.create(req.body);
    req.io.emit('rank_created', rank); // realtime
    res.status(201).json({
      success: true,
      data: rank,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getRank = async (rankId) => {
  const rank = await SeriesRank.findById(rankId);
  return rank;
};

exports.updateRank = async (req, res) => {
  try {
    const rank = await SeriesRank.findByIdAndUpdate(req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: rank,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteRank = async (req, res) => {
  try {
    const rank = await SeriesRank.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      data: rank,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSeriesRanks = async (seriesId) => {
  const ranks = await SeriesRank.find({
    seriesId,
  })
    .sort({ createdAt: -1 })
    .limit(1);
  return ranks;
};

exports.getGlobalRanks = async () => {
  const ranks = await SeriesRank.find({}).sort({ score: -1 }).limit(10);
  return ranks;
};