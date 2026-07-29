const mongoose = require('mongoose');
const Rating = require('../models/Rating');
const Ranking = require('../models/Ranking');
const Series = require('../models/Series');
const Notification = require('../models/Notification');
const { logAction } = require('../utils/auditLogger');

const MAX_IMPORT_ENTRIES = 500;

class ClientInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ClientInputError';
  }
}

const currentPeriod = (cycle, now = new Date()) => {
  if (cycle === 'WEEKLY') {
    const day = now.getUTCDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    const start = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday,
    ));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
  }

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
};

const parseDate = (value, fieldName) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ClientInputError(`${fieldName} must be a valid date`);
  }
  return date;
};

const parseNumber = (value, fieldName, { min = 0, max = Infinity, nullable = false } = {}) => {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    const range = Number.isFinite(max) ? ` between ${min} and ${max}` : ` at least ${min}`;
    throw new ClientInputError(`${fieldName} must be a finite number${range}`);
  }
  return parsed;
};

const normalizeMetricEntry = (entry, { fallbackPeriodStart = null } = {}) => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new ClientInputError('Each metric entry must be an object');
  }
  if (!mongoose.isValidObjectId(entry.seriesId)) {
    throw new ClientInputError('seriesId is invalid');
  }

  const cycle = String(entry.cycle || 'MONTHLY').toUpperCase();
  if (!['WEEKLY', 'MONTHLY'].includes(cycle)) {
    throw new ClientInputError('cycle must be WEEKLY or MONTHLY');
  }

  if (!entry.periodStart && entry.periodEnd && !fallbackPeriodStart) {
    throw new ClientInputError('periodStart is required when periodEnd is provided');
  }
  if (entry.periodEnd) {
    parseDate(entry.periodEnd, 'periodEnd');
  }

  // The server owns period boundaries. A historical periodStart remains historical,
  // but is aligned to the Monday/month containing it and periodEnd is derived.
  const anchor = entry.periodStart
    ? parseDate(entry.periodStart, 'periodStart')
    : fallbackPeriodStart
      ? parseDate(fallbackPeriodStart, 'periodStart')
      : new Date();
  const { start: periodStart, end: periodEnd } = currentPeriod(cycle, anchor);

  const sourceFrom = String(entry.sourceFrom || entry.source || 'MANUAL').trim();
  if (!sourceFrom) throw new ClientInputError('sourceFrom cannot be empty');

  return {
    seriesId: entry.seriesId,
    cycle,
    periodStart,
    periodEnd,
    voteCount: parseNumber(entry.voteCount, 'voteCount'),
    ratingScore: parseNumber(entry.ratingScore, 'ratingScore', { min: 0, max: 5 }),
    readerCount: parseNumber(entry.readerCount, 'readerCount'),
    revenue: parseNumber(entry.revenue, 'revenue', { nullable: true }),
    sourceFrom,
  };
};

const getStoredPeriod = (rating) => {
  const cycle = String(rating?.cycle || 'MONTHLY').toUpperCase();
  if (!['WEEKLY', 'MONTHLY'].includes(cycle)) return null;

  const storedStart = new Date(rating?.periodStart);
  const storedEnd = new Date(rating?.periodEnd);
  if (rating?.periodStart
    && rating?.periodEnd
    && !Number.isNaN(storedStart.getTime())
    && !Number.isNaN(storedEnd.getTime())
    && storedEnd > storedStart) {
    return { cycle, periodStart: storedStart, periodEnd: storedEnd };
  }

  const anchor = rating?.periodStart || rating?.createdAt;
  const date = new Date(anchor);
  if (!anchor || Number.isNaN(date.getTime())) return null;
  const { start: periodStart, end: periodEnd } = currentPeriod(cycle, date);
  return { cycle, periodStart, periodEnd };
};

const errorStatus = (error) => {
  if (error instanceof ClientInputError
    || error.name === 'ValidationError'
    || error.name === 'CastError') {
    return 400;
  }
  return 500;
};

const errorMessage = (error, fallback) => (
  errorStatus(error) === 500 ? fallback : error.message
);

const computeTrend = (rank, prevRank) => {
  if (prevRank === null || prevRank === undefined) return 'flat';
  if (rank < prevRank) return 'up';
  if (rank > prevRank) return 'down';
  return 'flat';
};

const recalculateRanking = async (cycle, periodStart, periodEnd) => {
  const scores = await Rating.aggregate([
    {
      $match: {
        cycle,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      },
    },
    {
      $group: {
        _id: '$seriesId',
        totalVotes: { $sum: '$voteCount' },
        averageRatingScore: { $avg: '$ratingScore' },
      },
    },
    { $sort: { totalVotes: -1, averageRatingScore: -1, _id: 1 } },
  ]);

  const rankingCycle = cycle.toLowerCase();
  const rankedSeriesIds = scores.map((score) => score._id);
  await Ranking.deleteMany({
    cycle: rankingCycle,
    cycleStart: new Date(periodStart),
    seriesId: { $nin: rankedSeriesIds },
  });

  for (let index = 0; index < scores.length; index += 1) {
    const score = scores[index];
    const newRank = index + 1;
    const [previousCycleRank, existingCurrent] = await Promise.all([
      Ranking.findOne({
        seriesId: score._id,
        cycle: rankingCycle,
        cycleStart: { $lt: new Date(periodStart) },
      }).sort({ cycleStart: -1 }).select('rank'),
      Ranking.findOne({
        seriesId: score._id,
        cycle: rankingCycle,
        cycleStart: new Date(periodStart),
      }).select('prevRank'),
    ]);
    const prevRank = previousCycleRank?.rank ?? existingCurrent?.prevRank ?? null;

    const trend = computeTrend(newRank, prevRank);

    await Ranking.findOneAndUpdate(
      {
        seriesId: score._id,
        cycle: rankingCycle,
        cycleStart: new Date(periodStart),
      },
      {
        $set: {
          rank: newRank,
          prevRank,
          votes: score.totalVotes,
          ratingScore: Number((score.averageRatingScore || 0).toFixed(2)),
          trend,
          cycleEnd: new Date(periodEnd),
        },
        $setOnInsert: {
          seriesId: score._id,
          cycle: rankingCycle,
          cycleStart: new Date(periodStart),
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    if (trend === 'down') {
      const seriesDoc = await Series.findById(score._id).select('title mangakaId editorId');
      if (seriesDoc) {
        const recipients = [seriesDoc.mangakaId, seriesDoc.editorId].filter(Boolean);
        for (const userId of recipients) {
          await Notification.create({
            userId,
            title: 'Series Ranking Dropped',
            content: `Series "${seriesDoc.title}" rank dropped from #${prevRank} to #${newRank} (${rankingCycle} cycle). Please review production plan.`,
            type: 'WARNING',
          });
        }
      }
    }
  }
};

const recalculateTouchedPeriods = async (periods) => {
  for (const period of periods.values()) {
    await recalculateRanking(period.cycle, period.periodStart, period.periodEnd);
  }
};

const periodKey = ({ cycle, periodStart, periodEnd }) => (
  `${cycle}:${new Date(periodStart).toISOString()}:${new Date(periodEnd).toISOString()}`
);

exports.submitRating = async (req, res) => {
  try {
    const data = normalizeMetricEntry(req.body);
    if (!(await Series.exists({ _id: data.seriesId }))) {
      return res.status(404).json({ success: false, message: 'Series not found' });
    }

    const rating = await Rating.create({ ...data, submittedBy: req.user._id });
    await recalculateRanking(rating.cycle, rating.periodStart, rating.periodEnd);
    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Created Reader Metrics',
      `Rating ID: ${rating._id}`,
      `Series ID: ${rating.seriesId}; Cycle: ${rating.cycle}`,
    );
    if (req.io) req.io.emit('rating_created', rating);
    return res.status(201).json({ success: true, data: rating });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Metrics already exist for this series, period, and source',
      });
    }
    const status = errorStatus(error);
    return res.status(status).json({
      success: false,
      message: errorMessage(error, 'Unable to create reader metrics'),
    });
  }
};

exports.importRatings = async (req, res) => {
  const { entries } = req.body || {};
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ success: false, message: 'entries must be a non-empty array' });
  }
  if (entries.length > MAX_IMPORT_ENTRIES) {
    return res.status(400).json({
      success: false,
      message: `A maximum of ${MAX_IMPORT_ENTRIES} entries can be imported at once`,
    });
  }

  const imported = [];
  const errors = [];
  const touchedPeriods = new Map();

  for (let index = 0; index < entries.length; index += 1) {
    try {
      const data = normalizeMetricEntry(entries[index]);
      if (!(await Series.exists({ _id: data.seriesId }))) {
        throw new ClientInputError('Series not found');
      }
      const rating = await Rating.create({ ...data, submittedBy: req.user._id });
      imported.push(rating);
      touchedPeriods.set(periodKey(rating), {
        cycle: rating.cycle,
        periodStart: rating.periodStart,
        periodEnd: rating.periodEnd,
      });
    } catch (error) {
      const isServerFailure = error.code !== 11000 && errorStatus(error) === 500;
      errors.push({
        index,
        type: isServerFailure ? 'SERVER' : 'CLIENT',
        message: error.code === 11000
          ? 'Duplicate series, period, and source'
          : errorMessage(error, 'Unable to process this metrics entry'),
      });
    }
  }

  try {
    await recalculateTouchedPeriods(touchedPeriods);
    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Imported Reader Metrics',
      'Rating import',
      `Imported: ${imported.length}; Failed: ${errors.length}`,
    );
    if (req.io && imported.length > 0) {
      req.io.emit('ratings_imported', { count: imported.length });
    }
    const responseStatus = imported.length > 0
      ? 201
      : errors.some((error) => error.type === 'SERVER') ? 500 : 400;
    return res.status(responseStatus).json({
      success: imported.length > 0,
      data: imported,
      summary: {
        total: entries.length,
        imported: imported.length,
        failed: errors.length,
      },
      errors,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRating = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.ratingId)) {
      return res.status(400).json({ success: false, message: 'Invalid ratingId' });
    }
    const rating = await Rating.findById(req.params.ratingId);
    if (!rating) {
      return res.status(404).json({ success: false, message: 'Rating not found' });
    }

    const oldPeriod = getStoredPeriod(rating);
    const merged = { ...rating.toObject(), ...req.body };
    if (req.body.source !== undefined && req.body.sourceFrom === undefined) {
      merged.sourceFrom = req.body.source;
    }
    const data = normalizeMetricEntry(merged, { fallbackPeriodStart: rating.createdAt });
    if (!(await Series.exists({ _id: data.seriesId }))) {
      return res.status(404).json({ success: false, message: 'Series not found' });
    }

    Object.assign(rating, data);
    await rating.save();
    if (oldPeriod) {
      await recalculateRanking(oldPeriod.cycle, oldPeriod.periodStart, oldPeriod.periodEnd);
    }
    if (!oldPeriod || periodKey(oldPeriod) !== periodKey(rating)) {
      await recalculateRanking(rating.cycle, rating.periodStart, rating.periodEnd);
    }

    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Updated Reader Metrics',
      `Rating ID: ${rating._id}`,
      `Series ID: ${rating.seriesId}; Cycle: ${rating.cycle}`,
    );
    if (req.io) req.io.emit('rating_updated', rating);
    return res.status(200).json({ success: true, data: rating });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Metrics already exist for this series, period, and source',
      });
    }
    const status = errorStatus(error);
    return res.status(status).json({
      success: false,
      message: errorMessage(error, 'Unable to update reader metrics'),
    });
  }
};

exports.deleteRating = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.ratingId)) {
      return res.status(400).json({ success: false, message: 'Invalid ratingId' });
    }
    const rating = await Rating.findByIdAndDelete(req.params.ratingId);
    if (!rating) {
      return res.status(404).json({ success: false, message: 'Rating not found' });
    }

    const deletedPeriod = getStoredPeriod(rating);
    if (deletedPeriod) {
      await recalculateRanking(
        deletedPeriod.cycle,
        deletedPeriod.periodStart,
        deletedPeriod.periodEnd,
      );
    }
    await logAction(
      req.user._id,
      req.user.name || 'Editorial Board',
      'Deleted Reader Metrics',
      `Rating ID: ${rating._id}`,
      `Series ID: ${rating.seriesId}; Cycle: ${rating.cycle}`,
    );
    if (req.io) req.io.emit('rating_deleted', { id: rating._id });
    return res.status(200).json({ success: true, data: rating });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ submittedBy: req.query.userId })
      .populate('seriesId', 'title')
      .sort({ periodStart: -1 });
    return res.status(200).json({ success: true, data: ratings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSeriesRatings = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.seriesId)) {
      return res.status(400).json({ success: false, message: 'Invalid seriesId' });
    }
    const ratings = await Rating.find({ seriesId: req.params.seriesId })
      .populate('submittedBy', 'name role')
      .sort({ periodStart: -1 });
    return res.status(200).json({ success: true, data: ratings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllRatings = async (req, res) => {
  try {
    const filter = {};
    if (req.query.cycle) {
      const cycle = String(req.query.cycle).toUpperCase();
      if (!['WEEKLY', 'MONTHLY'].includes(cycle)) {
        return res.status(400).json({
          success: false,
          message: 'cycle must be WEEKLY or MONTHLY',
        });
      }
      filter.cycle = cycle;
    }
    const ratings = await Rating.find(filter)
      .populate('seriesId', 'title')
      .populate('submittedBy', 'name role')
      .sort({ periodStart: -1, createdAt: -1 });
    return res.status(200).json({ success: true, data: ratings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.recalculateRanking = recalculateRanking;
