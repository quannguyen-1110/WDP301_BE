const Rating = require('../models/Rating.js');
const Ranking = require('../models/Ranking.js');

const updateMonthlyRank = async (seriesId) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  );

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
  const rankedSeriesIds = seriesScores.map((score) => score._id);
  await Ranking.deleteMany({
    cycle: 'monthly',
    cycleStart: startOfMonth,
    seriesId: { $nin: rankedSeriesIds },
  });


  for (let index = 0; index < seriesScores.length; index += 1) {
    const score = seriesScores[index];
    const newRank = index + 1;
    const existingRank = await Ranking.findOne({
      seriesId: score._id,
      cycle: 'monthly',
      cycleStart: startOfMonth,
    });
    if (existingRank) {
      const previousRank = existingRank.rank;
      existingRank.prevRank = previousRank;
      existingRank.rank = newRank;
      existingRank.votes = score.totalVoteCount;
      existingRank.trend = newRank < previousRank
        ? 'up'
        : newRank > previousRank
          ? 'down'
          : 'flat';
      await existingRank.save();
    } else {
      await Ranking.create({
        seriesId: score._id,
        rank: newRank,
        prevRank: null,
        votes: score.totalVoteCount,
        trend: 'flat',
        cycle: 'monthly',
        cycleStart: startOfMonth,
        cycleEnd: startOfNextMonth,
      });
    }
  }
};

exports.submitRating = async (req, res) => {
  try {
    const rating = await Rating.create({
      ...req.body,
      submittedBy: req.user._id,
    });
    if (req.io) req.io.emit('rating_created', rating);

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
    const rating = await Rating.findByIdAndUpdate(req.params.ratingId, req.body, {
      new: true,
      runValidators: true,
    });
    if (!rating) {
      return res.status(404).json({ success: false, message: 'Rating not found' });
    }
    await updateMonthlyRank(rating.seriesId);
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
    const rating = await Rating.findByIdAndDelete(req.params.ratingId);
    if (!rating) {
      return res.status(404).json({ success: false, message: 'Rating not found' });
    }
    await updateMonthlyRank(rating.seriesId);
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

exports.getAllRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({});
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
}