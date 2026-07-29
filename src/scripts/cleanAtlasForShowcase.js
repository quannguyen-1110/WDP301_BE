const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const Series = require('../models/Series');
const Proposal = require('../models/SeriesProposal');
const Chapter = require('../models/Chapter');
const Page = require('../models/Page');
const Task = require('../models/Task');
const Annotation = require('../models/Annotation');
const Submission = require('../models/SeriesSubmission');
const Vote = require('../models/Vote');
const Rating = require('../models/Rating');
const Ranking = require('../models/Ranking');
const SeriesRank = require('../models/SeriesRank');
const File = require('../models/File');
const Notification = require('../models/Notification');
const Earning = require('../models/AssistantEarning');
const DefenseReport = require('../models/DefenseReport');
const AuditLog = require('../models/AuditLog');

const stringifyIds = (items) => new Set(items.map((item) => String(item)));
const intersects = (values, idSet) => values.some(
  (value) => value && idSet.has(String(value)),
);

async function collectCleanupPlan() {
  const protectedSeries = await Series.find({ isCatalogFeatured: true })
    .sort({ title: 1 })
    .lean();
  const targetSeries = await Series.find({ isCatalogFeatured: { $ne: true } })
    .sort({ title: 1 })
    .lean();
  if (!protectedSeries.length) {
    throw new Error('No protected catalogue series were found; cleanup aborted.');
  }

  const protectedSeriesIds = protectedSeries.map((item) => item._id);
  const targetSeriesIds = targetSeries.map((item) => item._id);
  const proposals = await Proposal.find({
    $or: [
      { seriesId: { $in: targetSeriesIds } },
      { seriesId: null },
      { seriesId: { $exists: false } },
    ],
  }).sort({ title: 1 }).lean();
  const proposalIds = proposals.map((item) => item._id);
  const chapters = await Chapter.find({ seriesId: { $in: targetSeriesIds } }).lean();
  const chapterIds = chapters.map((item) => item._id);
  const pages = await Page.find({ chapterId: { $in: chapterIds } }).lean();
  const pageIds = pages.map((item) => item._id);
  const tasks = await Task.find({
    $or: [
      { seriesId: { $in: targetSeriesIds } },
      { chapterId: { $in: chapterIds } },
      { pageIds: { $in: pageIds } },
    ],
  }).lean();
  const taskIds = tasks.map((item) => item._id);
  const submissions = await Submission.find({
    $or: [
      { seriesId: { $in: targetSeriesIds } },
      { chapterId: { $in: chapterIds } },
      { proposalId: { $in: proposalIds } },
    ],
  }).lean();
  const submissionIds = submissions.map((item) => item._id);

  const [
    votes,
    annotations,
    ratings,
    rankings,
    seriesRanks,
    files,
    linkedNotifications,
    defenseReports,
    earnings,
    seedAuditLogs,
  ] = await Promise.all([
    Vote.find({ submissionId: { $in: submissionIds } }).lean(),
    Annotation.find({ pageId: { $in: pageIds } }).lean(),
    Rating.find({ seriesId: { $in: targetSeriesIds } }).lean(),
    Ranking.find({ seriesId: { $in: targetSeriesIds } }).lean(),
    SeriesRank.find({ seriesId: { $in: targetSeriesIds } }).lean(),
    File.find({ chapterId: { $in: chapterIds } }).lean(),
    Notification.find({
      $or: [
        { seriesId: { $in: targetSeriesIds } },
        { chapterId: { $in: chapterIds } },
        { taskId: { $in: taskIds } },
      ],
    }).lean(),
    DefenseReport.find({ seriesId: { $in: targetSeriesIds } }).lean(),
    Earning.find({
      approvedPages: {
        $elemMatch: {
          $or: [
            { seriesId: { $in: targetSeriesIds } },
            { chapterId: { $in: chapterIds } },
            { pageId: { $in: pageIds } },
            { taskId: { $in: taskIds } },
          ],
        },
      },
    }).lean(),
    AuditLog.find({ action: 'Seeded demo catalogue' }).lean(),
  ]);

  const seededNotifications = [];
  for (const auditLog of seedAuditLogs) {
    const center = new Date(auditLog.createdAt).getTime();
    const lower = new Date(center - 5 * 60 * 1000);
    const upper = new Date(center + 5 * 60 * 1000);
    seededNotifications.push(...await Notification.find({
      createdAt: { $gte: lower, $lte: upper },
      seriesId: null,
      chapterId: null,
      taskId: null,
    }).lean());
  }

  const notificationsById = new Map();
  [...linkedNotifications, ...seededNotifications].forEach((item) => {
    notificationsById.set(String(item._id), item);
  });

  const targetSeriesIdSet = stringifyIds(targetSeriesIds);
  const chapterIdSet = stringifyIds(chapterIds);
  const pageIdSet = stringifyIds(pageIds);
  const taskIdSet = stringifyIds(taskIds);
  const earningUpdates = [];
  const earningsToDelete = [];

  for (const earning of earnings) {
    const approvedPages = earning.approvedPages.filter((entry) => (
      !targetSeriesIdSet.has(String(entry.seriesId))
      && !chapterIdSet.has(String(entry.chapterId))
      && !pageIdSet.has(String(entry.pageId))
      && !taskIdSet.has(String(entry.taskId))
    ));
    if (approvedPages.length === 0) {
      earningsToDelete.push(earning);
    } else {
      earningUpdates.push({
        earning,
        approvedPages,
        totalPagesApproved: approvedPages.length,
        totalEarning: approvedPages.length * earning.ratePerPage,
      });
    }
  }

  const protectedChapterCount = await Chapter.countDocuments({
    seriesId: { $in: protectedSeriesIds },
  });
  const protectedRatings = await Rating.countDocuments({
    seriesId: { $in: protectedSeriesIds },
  });

  return {
    protectedSeries,
    protectedChapterCount,
    protectedRatings,
    targetSeries,
    proposals,
    chapters,
    pages,
    tasks,
    submissions,
    votes,
    annotations,
    ratings,
    rankings,
    seriesRanks,
    files,
    notifications: [...notificationsById.values()],
    defenseReports,
    earnings,
    earningUpdates,
    earningsToDelete,
    seedAuditLogs,
  };
}

function printPlan(plan) {
  console.table(plan.targetSeries.map((item) => ({
    title: item.title,
    status: item.status,
  })));
  console.table(plan.proposals.map((item) => ({
    title: item.title,
    status: item.status,
  })));
  console.log('Protected data:', {
    catalogueSeries: plan.protectedSeries.length,
    catalogueChapters: plan.protectedChapterCount,
    catalogueRatings: plan.protectedRatings,
  });
  console.log('Cleanup totals:', {
    series: plan.targetSeries.length,
    proposals: plan.proposals.length,
    chapters: plan.chapters.length,
    pages: plan.pages.length,
    tasks: plan.tasks.length,
    submissions: plan.submissions.length,
    votes: plan.votes.length,
    annotations: plan.annotations.length,
    ratings: plan.ratings.length,
    rankings: plan.rankings.length,
    seriesRanks: plan.seriesRanks.length,
    files: plan.files.length,
    notifications: plan.notifications.length,
    defenseReports: plan.defenseReports.length,
    earningsToDelete: plan.earningsToDelete.length,
    earningsToUpdate: plan.earningUpdates.length,
    seedAuditLogs: plan.seedAuditLogs.length,
  });
}

function createBackup(plan) {
  const directory = path.resolve(__dirname, '../../backups');
  fs.mkdirSync(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    directory,
    `atlas-before-showcase-cleanup-${timestamp}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify({
    targetSeries: plan.targetSeries,
    proposals: plan.proposals,
    chapters: plan.chapters,
    pages: plan.pages,
    tasks: plan.tasks,
    submissions: plan.submissions,
    votes: plan.votes,
    annotations: plan.annotations,
    ratings: plan.ratings,
    rankings: plan.rankings,
    seriesRanks: plan.seriesRanks,
    files: plan.files,
    notifications: plan.notifications,
    defenseReports: plan.defenseReports,
    earnings: plan.earnings,
    auditLogs: plan.seedAuditLogs,
  }, null, 2));
  return backupPath;
}

async function applyCleanup(plan) {
  const ids = (items) => items.map((item) => item._id);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const update of plan.earningUpdates) {
        await Earning.updateOne(
          { _id: update.earning._id },
          {
            $set: {
              approvedPages: update.approvedPages,
              totalPagesApproved: update.totalPagesApproved,
              totalEarning: update.totalEarning,
            },
          },
          { session },
        );
      }

      const deletions = [
        [Vote, plan.votes],
        [Submission, plan.submissions],
        [Annotation, plan.annotations],
        [Notification, plan.notifications],
        [File, plan.files],
        [DefenseReport, plan.defenseReports],
        [Task, plan.tasks],
        [Page, plan.pages],
        [Chapter, plan.chapters],
        [Rating, plan.ratings],
        [Ranking, plan.rankings],
        [SeriesRank, plan.seriesRanks],
        [Proposal, plan.proposals],
        [Series, plan.targetSeries],
        [Earning, plan.earningsToDelete],
        [AuditLog, plan.seedAuditLogs],
      ];
      for (const [Model, documents] of deletions) {
        if (documents.length) {
          await Model.deleteMany({ _id: { $in: ids(documents) } }, { session });
        }
      }
    });
  } finally {
    await session.endSession();
  }
}

async function validateCleanup() {
  const plan = await collectCleanupPlan();
  const remaining = [
    plan.targetSeries.length,
    plan.proposals.length,
    plan.chapters.length,
    plan.pages.length,
    plan.tasks.length,
    plan.submissions.length,
  ].reduce((sum, count) => sum + count, 0);
  if (remaining !== 0) {
    throw new Error(`Cleanup validation failed: ${remaining} target records remain.`);
  }
  return plan;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from .env');
  const shouldApply = process.argv.includes('--apply');
  const isRemote = !/mongodb:\/\/(localhost|127\.0\.0\.1)/i.test(process.env.MONGODB_URI);
  if (shouldApply && isRemote && !process.argv.includes('--confirm-remote')) {
    throw new Error('Remote MongoDB detected. Add --confirm-remote after reviewing dry-run output.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const plan = await collectCleanupPlan();
  printPlan(plan);

  if (!shouldApply) {
    console.log('Dry run only. No database records were changed.');
    return;
  }

  console.log('Backup written:', createBackup(plan));
  await applyCleanup(plan);
  const validated = await validateCleanup();
  console.log('Cleanup completed successfully.', {
    remainingCatalogueSeries: validated.protectedSeries.length,
    remainingCatalogueChapters: validated.protectedChapterCount,
    remainingCatalogueRatings: validated.protectedRatings,
  });
}

main()
  .catch((error) => {
    console.error('Showcase cleanup failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
