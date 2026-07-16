const Ranking = require('../models/Ranking');
const User = require('../models/User');

const serializeRanking = async (ranking) => {
  let author = '';
  if (ranking.seriesId?.mangakaId) {
    const user = await User.findById(ranking.seriesId.mangakaId).select('name');
    author = user?.name || '';
  }

  return {
    id: ranking._id,
    rank: ranking.rank,
    prevRank: ranking.prevRank,
    title: ranking.seriesId?.title || 'Unknown',
    seriesId: ranking.seriesId?._id || ranking.seriesId,
    author,
    votes: ranking.votes,
    ratingScore: ranking.ratingScore || 0,
    trend: ranking.trend,
    directive: ranking.directive,
    cycle: ranking.cycle,
    cycleStart: ranking.cycleStart,
    cycleEnd: ranking.cycleEnd,
  };
};

exports.getRankings = async (req, res) => {
  try {
    const cycle = String(req.query.type || 'weekly').toLowerCase();
    if (!['weekly', 'monthly'].includes(cycle)) {
      return res.status(400).json({
        success: false,
        message: 'type must be weekly or monthly',
      });
    }

    const latest = await Ranking.findOne({ cycle })
      .sort({ cycleStart: -1 })
      .select('cycleStart');
    if (!latest) return res.status(200).json({ success: true, data: [] });

    const rankings = await Ranking.find({
      cycle,
      cycleStart: latest.cycleStart,
    })
      .sort({ rank: 1 })
      .populate({ path: 'seriesId', select: 'title mangakaId' });
    const data = await Promise.all(rankings.map(serializeRanking));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateScores = async (req, res) => res.status(409).json({
  success: false,
  message: 'Rankings are calculated from reader metrics. Update /api/ratings instead.',
});

exports.applyDirective = async (req, res) => res.status(409).json({
  success: false,
  message: 'Series directives require Board voting. Use /api/directives instead.',
});
