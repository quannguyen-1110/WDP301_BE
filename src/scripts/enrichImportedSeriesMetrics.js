const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Series = require('../models/Series');
const Chapter = require('../models/Chapter');
const Page = require('../models/Page');
const Rating = require('../models/Rating');
const Ranking = require('../models/Ranking');
const SeriesRank = require('../models/SeriesRank');

const HISTORY_WEEKS = 6;
const SOURCE = 'DEMO_IMPORTED_SERIES_HISTORY';
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
const sameTime = (left, right) => (
  left && right && new Date(left).getTime() === new Date(right).getTime()
);

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0111\u0110]/g, 'd')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function getSeriesSearchText(series) {
  return normalize(
    [series.title, series.originalTitle, series.localizedTitle]
      .filter(Boolean)
      .join(' '),
  );
}

function extractLocalPageSource(imageUrl) {
  const match = String(imageUrl || '').match(
    /^\/manga\/([^/]+)\/chapter-(\d+)\/page-(\d+)\.[a-z0-9]+(?:\?.*)?$/i,
  );
  if (!match) return null;
  return {
    slug: match[1],
    chapterNumber: Number(match[2]),
    pageNumber: Number(match[3]),
  };
}

function isImportedChapter(series, chapter, pages) {
  if (!pages.length) return false;
  const ordered = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const sources = ordered.map((page) => extractLocalPageSource(page.imageUrl));
  if (sources.some((source) => !source)) return false;

  const first = sources[0];
  const complete = ordered.every((page, index) => (
    page.pageNumber === index + 1
    && sources[index].pageNumber === index + 1
    && sources[index].slug === first.slug
    && sources[index].chapterNumber === first.chapterNumber
  ));

  return complete
    && chapter.chapterNumber === first.chapterNumber
    && getSeriesSearchText(series).includes(normalize(first.slug));
}

async function findImportedSeries() {
  const series = await Series.find({ isCatalogFeatured: true }).sort({ title: 1 }).lean();
  const chapters = await Chapter.find({
    seriesId: { $in: series.map((item) => item._id) },
  }).lean();
  const pages = await Page.find({
    chapterId: { $in: chapters.map((chapter) => chapter._id) },
  }).lean();

  const pagesByChapter = new Map();
  pages.forEach((page) => {
    const key = String(page.chapterId);
    pagesByChapter.set(key, [...(pagesByChapter.get(key) || []), page]);
  });

  return series
    .map((item) => {
      const importedChapters = chapters.filter((chapter) => (
        String(chapter.seriesId) === String(item._id)
        && isImportedChapter(item, chapter, pagesByChapter.get(String(chapter._id)) || [])
      ));
      return { series: item, chapters: importedChapters };
    })
    .filter((item) => item.chapters.length > 0);
}

function calculateAnchorDefaults(existing) {
  const latestRatings = existing
    .map((item) => item.ratings.at(-1))
    .filter(Boolean);
  const latestRankings = existing
    .map((item) => item.rankings.at(-1))
    .filter(Boolean);
  const growthRates = existing
    .map((item) => {
      const latest = item.ratings.at(-1);
      const previous = item.ratings.at(-2);
      if (!latest || !previous || previous.voteCount <= 0) return null;
      return latest.voteCount / previous.voteCount;
    })
    .filter(Number.isFinite);

  return {
    voteCount: Math.round(median(latestRatings.map((item) => item.voteCount)) || 100000),
    ratingScore: median(latestRatings.map((item) => item.ratingScore)) || 4,
    readerRatio: median(
      latestRatings.map((item) => item.readerCount / Math.max(1, item.voteCount)),
    ) || 4,
    revenueRatio: median(
      latestRatings.map((item) => item.revenue / Math.max(1, item.voteCount)),
    ) || 1000,
    rank: Math.round(median(latestRankings.map((item) => item.rank)) || 1),
    growthRate: clamp(median(growthRates) || 1.08, 1.03, 1.18),
  };
}

async function collectPlan() {
  const imported = await findImportedSeries();
  if (!imported.length) throw new Error('No imported catalogue series were found.');

  const allExisting = [];
  for (const item of imported) {
    allExisting.push({
      ...item,
      ratings: await Rating.find({ seriesId: item.series._id })
        .sort({ periodStart: 1 })
        .lean(),
      rankings: await Ranking.find({ seriesId: item.series._id })
        .sort({ cycleStart: 1 })
        .lean(),
      seriesRanks: await SeriesRank.find({ seriesId: item.series._id })
        .sort({ rankedOn: 1 })
        .lean(),
    });
  }

  const defaults = calculateAnchorDefaults(allExisting);
  const latestEndTimes = allExisting.flatMap((item) => [
    item.ratings.at(-1)?.periodEnd,
    item.rankings.at(-1)?.cycleEnd,
  ]).filter(Boolean).map((date) => new Date(date).getTime());
  const anchorEnd = new Date(latestEndTimes.length ? Math.max(...latestEndTimes) : Date.now());
  const boardMember = await User.findOne({ role: 'BOARD_MEMBER' }).sort({ createdAt: 1 }).lean();
  const existingSubmitter = allExisting
    .flatMap((item) => item.ratings)
    .find((rating) => rating.submittedBy)?.submittedBy;
  const submittedBy = existingSubmitter || boardMember?._id;
  if (!submittedBy) throw new Error('A board member is required to submit rating history.');

  const ratingUpserts = [];
  const rankingUpserts = [];
  const seriesRankUpserts = [];
  const summary = [];

  for (const item of allExisting) {
    const latestRating = item.ratings.at(-1);
    const previousRating = item.ratings.at(-2);
    const latestRanking = item.rankings.at(-1);
    const previousRanking = item.rankings.at(-2);
    const anchorVote = latestRating?.voteCount || defaults.voteCount;
    const anchorScore = latestRating?.ratingScore || defaults.ratingScore;
    const readerRatio = latestRating
      ? latestRating.readerCount / Math.max(1, latestRating.voteCount)
      : defaults.readerRatio;
    const revenueRatio = latestRating?.revenue
      ? latestRating.revenue / Math.max(1, latestRating.voteCount)
      : defaults.revenueRatio;
    const growthRate = latestRating && previousRating && previousRating.voteCount > 0
      ? clamp(latestRating.voteCount / previousRating.voteCount, 1.03, 1.18)
      : defaults.growthRate;
    const anchorRank = latestRanking?.rank || defaults.rank;
    const rankStep = latestRanking && previousRanking
      ? clamp(previousRanking.rank - latestRanking.rank, -1, 1)
      : 0;

    let addedRatings = 0;
    let addedRankings = 0;
    for (let weeksAgo = HISTORY_WEEKS - 1; weeksAgo >= 0; weeksAgo -= 1) {
      const periodEnd = new Date(anchorEnd.getTime() - weeksAgo * WEEK);
      const periodStart = new Date(periodEnd.getTime() - WEEK);
      const voteCount = Math.round(anchorVote / (growthRate ** weeksAgo));
      const ratingScore = Number(clamp(anchorScore - weeksAgo * 0.08, 0, 5).toFixed(2));
      const rank = clamp(anchorRank + rankStep * weeksAgo, 1, 99);
      const previousRank = clamp(rank + rankStep, 1, 99);

      if (!item.ratings.some((rating) => sameTime(rating.periodStart, periodStart))) {
        ratingUpserts.push({
          updateOne: {
            filter: {
              seriesId: item.series._id,
              cycle: 'WEEKLY',
              periodStart,
              sourceFrom: SOURCE,
            },
            update: {
              $setOnInsert: {
                periodEnd,
                voteCount,
                ratingScore,
                readerCount: Math.round(voteCount * readerRatio),
                revenue: Math.round(voteCount * revenueRatio),
                submittedBy,
              },
            },
            upsert: true,
          },
        });
        addedRatings += 1;
      }

      if (!item.rankings.some((ranking) => sameTime(ranking.cycleStart, periodStart))) {
        rankingUpserts.push({
          updateOne: {
            filter: {
              seriesId: item.series._id,
              cycle: 'weekly',
              cycleStart: periodStart,
            },
            update: {
              $setOnInsert: {
                cycleEnd: periodEnd,
                rank,
                prevRank: previousRank,
                votes: voteCount,
                ratingScore,
                trend: rank < previousRank ? 'up' : rank > previousRank ? 'down' : 'flat',
              },
            },
            upsert: true,
          },
        });
        addedRankings += 1;
      }
    }

    const latestSeriesRank = item.seriesRanks.at(-1);
    seriesRankUpserts.push({
      updateOne: {
        filter: latestSeriesRank
          ? { _id: latestSeriesRank._id }
          : { seriesId: item.series._id, rankedOn: anchorEnd },
        update: {
          $set: {
            seriesId: item.series._id,
            rank: anchorRank,
            prevRank: previousRanking?.rank || anchorRank,
            rankedOn: anchorEnd,
          },
        },
        upsert: !latestSeriesRank,
      },
    });

    summary.push({
      title: item.series.title,
      chapters: item.chapters.length,
      currentRatings: item.ratings.length,
      addRatings: addedRatings,
      currentRankings: item.rankings.length,
      addRankings: addedRankings,
    });
  }

  return {
    imported: allExisting,
    ratingUpserts,
    rankingUpserts,
    seriesRankUpserts,
    summary,
  };
}

function createBackup(plan) {
  const directory = path.resolve(__dirname, '../../backups');
  fs.mkdirSync(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    directory,
    `imported-series-metrics-before-${timestamp}.json`,
  );
  fs.writeFileSync(
    backupPath,
    JSON.stringify({
      series: plan.imported.map((item) => ({
        series: item.series,
        chapters: item.chapters,
        ratings: item.ratings,
        rankings: item.rankings,
        seriesRanks: item.seriesRanks,
      })),
    }, null, 2),
  );
  return backupPath;
}

async function applyPlan(plan) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (plan.ratingUpserts.length) {
        await Rating.bulkWrite(plan.ratingUpserts, { session });
      }
      if (plan.rankingUpserts.length) {
        await Ranking.bulkWrite(plan.rankingUpserts, { session });
      }
      if (plan.seriesRankUpserts.length) {
        await SeriesRank.bulkWrite(plan.seriesRankUpserts, { session });
      }
    });
  } finally {
    await session.endSession();
  }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from .env');
  const shouldApply = process.argv.includes('--apply');
  const isRemote = !/mongodb:\/\/(localhost|127\.0\.0\.1)/i.test(process.env.MONGODB_URI);
  if (shouldApply && isRemote && !process.argv.includes('--confirm-remote')) {
    throw new Error('Remote MongoDB detected. Add --confirm-remote after reviewing dry-run output.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const plan = await collectPlan();
  console.table(plan.summary);
  console.log('Planned additions:', {
    ratings: plan.ratingUpserts.length,
    rankings: plan.rankingUpserts.length,
    seriesRanks: plan.seriesRankUpserts.length,
  });

  if (!shouldApply) {
    console.log('Dry run only. No database records were changed.');
    return;
  }

  console.log('Backup written:', createBackup(plan));
  await applyPlan(plan);
  const verification = await collectPlan();
  console.table(verification.summary);
  console.log('Imported-series metric enrichment completed successfully.');
}

main()
  .catch((error) => {
    console.error('Metric enrichment failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
