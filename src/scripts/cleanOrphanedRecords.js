const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const Series = require('../models/Series');
const Chapter = require('../models/Chapter');
const Submission = require('../models/SeriesSubmission');
const Vote = require('../models/Vote');
const Rating = require('../models/Rating');
const Ranking = require('../models/Ranking');
const SeriesRank = require('../models/SeriesRank');
const Page = require('../models/Page');
const File = require('../models/File');

async function collectPlan() {
  const [seriesIds, chapterIds, submissionIds] = await Promise.all([
    Series.distinct('_id'),
    Chapter.distinct('_id'),
    Submission.distinct('_id'),
  ]);

  const [
    votes,
    ratings,
    rankings,
    seriesRanks,
    pages,
    files,
  ] = await Promise.all([
    Vote.find({ submissionId: { $nin: submissionIds } }).lean(),
    Rating.find({ seriesId: { $nin: seriesIds } }).lean(),
    Ranking.find({ seriesId: { $nin: seriesIds } }).lean(),
    SeriesRank.find({ seriesId: { $nin: seriesIds } }).lean(),
    Page.find({ chapterId: { $nin: chapterIds } }).lean(),
    File.find({
      $or: [
        { chapterId: { $nin: chapterIds } },
        { chapterId: null },
        { chapterId: { $exists: false } },
      ],
    }).lean(),
  ]);

  return { votes, ratings, rankings, seriesRanks, pages, files };
}

function printPlan(plan) {
  console.log('Orphan cleanup totals:', {
    votes: plan.votes.length,
    ratings: plan.ratings.length,
    rankings: plan.rankings.length,
    seriesRanks: plan.seriesRanks.length,
    pages: plan.pages.length,
    files: plan.files.length,
  });
}

function createBackup(plan) {
  const directory = path.resolve(__dirname, '../../backups');
  fs.mkdirSync(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    directory,
    `atlas-orphans-before-cleanup-${timestamp}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(plan, null, 2));
  return backupPath;
}

async function applyPlan(plan) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const deletions = [
        [Vote, plan.votes],
        [Rating, plan.ratings],
        [Ranking, plan.rankings],
        [SeriesRank, plan.seriesRanks],
        [Page, plan.pages],
        [File, plan.files],
      ];
      for (const [Model, documents] of deletions) {
        if (documents.length) {
          await Model.collection.deleteMany(
            { _id: { $in: documents.map((item) => item._id) } },
            { session },
          );
        }
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
  printPlan(plan);

  if (!shouldApply) {
    console.log('Dry run only. No database records were changed.');
    return;
  }

  console.log('Backup written:', createBackup(plan));
  await applyPlan(plan);
  const verification = await collectPlan();
  printPlan(verification);
  const remaining = Object.values(verification)
    .reduce((sum, documents) => sum + documents.length, 0);
  if (remaining) throw new Error(`${remaining} orphan records remain.`);
  console.log('Orphan cleanup completed successfully.');
}

main()
  .catch((error) => {
    console.error('Orphan cleanup failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
