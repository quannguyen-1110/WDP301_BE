const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const Series = require('../models/Series');
const Chapter = require('../models/Chapter');
const Page = require('../models/Page');
const Task = require('../models/Task');
const Annotation = require('../models/Annotation');
const Submission = require('../models/SeriesSubmission');
const Vote = require('../models/Vote');
const File = require('../models/File');
const Notification = require('../models/Notification');
const Earning = require('../models/AssistantEarning');

const serialize = (value) => JSON.parse(JSON.stringify(value));
const idStrings = (values) => values.map((value) => String(value));

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

function inspectImportedChapter(series, chapter, pages) {
  if (!pages.length) return null;
  const orderedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
  const sources = orderedPages.map((page) => extractLocalPageSource(page.imageUrl));
  if (sources.some((sourceItem) => !sourceItem)) return null;

  const firstSource = sources[0];
  const isCompleteSequence = orderedPages.every((page, index) => (
    page.pageNumber === index + 1
    && sources[index].pageNumber === index + 1
    && sources[index].slug === firstSource.slug
    && sources[index].chapterNumber === firstSource.chapterNumber
  ));
  if (!isCompleteSequence || chapter.chapterNumber !== firstSource.chapterNumber) return null;

  const normalizedSlug = normalize(firstSource.slug);
  const normalizedSeries = getSeriesSearchText(series);
  if (!normalizedSeries.includes(normalizedSlug)) return null;

  return {
    slug: firstSource.slug,
    chapterNumber: firstSource.chapterNumber,
    pageCount: orderedPages.length,
    coverUrl: `/manga/${firstSource.slug}/cover.jpg`,
  };
}

async function collectRepairPlan() {
  const series = await Series.find({ isCatalogFeatured: true }).sort({ title: 1 }).lean();
  if (!series.length) throw new Error('No featured catalogue series were found.');

  const seriesIds = series.map((item) => item._id);
  const chapters = await Chapter.find({ seriesId: { $in: seriesIds } })
    .sort({ seriesId: 1, chapterNumber: 1 })
    .lean();
  const chapterIds = chapters.map((item) => item._id);
  const pages = await Page.find({ chapterId: { $in: chapterIds } })
    .sort({ chapterId: 1, pageNumber: 1 })
    .lean();

  const pagesByChapter = new Map();
  pages.forEach((page) => {
    const chapterId = String(page.chapterId);
    const current = pagesByChapter.get(chapterId) || [];
    current.push(page);
    pagesByChapter.set(chapterId, current);
  });

  const keepChapterIds = new Set();
  const coverUpdates = [];
  const summary = [];

  for (const item of series) {
    const itemChapters = chapters.filter(
      (chapter) => String(chapter.seriesId) === String(item._id),
    );
    const matchingChapters = itemChapters
      .map((chapter) => ({
        chapter,
        source: inspectImportedChapter(
          item,
          chapter,
          pagesByChapter.get(String(chapter._id)) || [],
        ),
      }))
      .filter((candidate) => candidate.source);

    if (matchingChapters.length === 0) {
      const currentCover = String(item.imageUrl || '');
      const localCover = currentCover.match(
        /^\/manga\/([^/]+)\/cover\.[a-z0-9]+(?:\?.*)?$/i,
      );
      const hasMatchingCover = localCover
        && getSeriesSearchText(item).includes(normalize(localCover[1]));
      coverUpdates.push({
        seriesId: item._id,
        imageUrl: hasMatchingCover ? currentCover : '',
      });
      summary.push({
        title: item.title,
        result: 'catalogue-only',
        keptChapters: 0,
        removedChapters: itemChapters.length,
      });
      continue;
    }

    if (matchingChapters.length !== 1) {
      throw new Error(
        `${item.title}: found ${matchingChapters.length} matching imported chapters; manual review is required.`,
      );
    }

    const { chapter: keepChapter, source: importedSource } = matchingChapters[0];
    keepChapterIds.add(String(keepChapter._id));
    coverUpdates.push({
      seriesId: item._id,
      imageUrl: importedSource.coverUrl,
    });
    summary.push({
      title: item.title,
      result: 'imported',
      keptChapter: keepChapter.chapterNumber,
      keptPages: importedSource.pageCount,
      source: importedSource.slug,
      removedChapters: itemChapters.length - 1,
    });
  }

  const chaptersToDelete = chapters.filter(
    (chapter) => !keepChapterIds.has(String(chapter._id)),
  );
  const chapterIdsToDelete = chaptersToDelete.map((chapter) => chapter._id);
  const pagesToDelete = pages.filter(
    (page) => chapterIdsToDelete.some((id) => String(id) === String(page.chapterId)),
  );
  const pageIdsToDelete = pagesToDelete.map((page) => page._id);

  const tasks = chapterIdsToDelete.length
    ? await Task.find({
      $or: [
        { chapterId: { $in: chapterIdsToDelete } },
        { pageIds: { $in: pageIdsToDelete } },
      ],
    }).lean()
    : [];
  const taskIds = tasks.map((task) => task._id);

  const submissions = chapterIdsToDelete.length
    ? await Submission.find({ chapterId: { $in: chapterIdsToDelete } }).lean()
    : [];
  const submissionIds = submissions.map((submission) => submission._id);

  const [
    votes,
    annotations,
    files,
    notifications,
    earnings,
  ] = await Promise.all([
    submissionIds.length ? Vote.find({ submissionId: { $in: submissionIds } }).lean() : [],
    pageIdsToDelete.length ? Annotation.find({ pageId: { $in: pageIdsToDelete } }).lean() : [],
    chapterIdsToDelete.length ? File.find({ chapterId: { $in: chapterIdsToDelete } }).lean() : [],
    (chapterIdsToDelete.length || taskIds.length)
      ? Notification.find({
        $or: [
          { chapterId: { $in: chapterIdsToDelete } },
          { taskId: { $in: taskIds } },
        ],
      }).lean()
      : [],
    (chapterIdsToDelete.length || pageIdsToDelete.length || taskIds.length)
      ? Earning.find({
        approvedPages: {
          $elemMatch: {
            $or: [
              { chapterId: { $in: chapterIdsToDelete } },
              { pageId: { $in: pageIdsToDelete } },
              { taskId: { $in: taskIds } },
            ],
          },
        },
      }).lean()
      : [],
  ]);

  return {
    series,
    chapters,
    pages,
    coverUpdates,
    chaptersToDelete,
    pagesToDelete,
    tasks,
    submissions,
    votes,
    annotations,
    files,
    notifications,
    earnings,
    summary,
  };
}

function printPlan(plan) {
  console.table(plan.summary);
  console.log('Repair totals:', {
    featuredSeries: plan.series.length,
    chaptersToDelete: plan.chaptersToDelete.length,
    pagesToDelete: plan.pagesToDelete.length,
    tasksToDelete: plan.tasks.length,
    submissionsToDelete: plan.submissions.length,
    votesToDelete: plan.votes.length,
    annotationsToDelete: plan.annotations.length,
    filesToDelete: plan.files.length,
    notificationsToDelete: plan.notifications.length,
    earningsToRecalculate: plan.earnings.length,
  });
}

function createBackup(plan) {
  const backupDirectory = path.resolve(__dirname, '../../backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    backupDirectory,
    `catalogue-before-repair-${timestamp}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(serialize(plan), null, 2));
  return backupPath;
}

async function applyRepair(plan) {
  const chapterIds = plan.chaptersToDelete.map((item) => item._id);
  const pageIds = plan.pagesToDelete.map((item) => item._id);
  const taskIds = plan.tasks.map((item) => item._id);
  const submissionIds = plan.submissions.map((item) => item._id);
  const notificationIds = plan.notifications.map((item) => item._id);
  const fileIds = plan.files.map((item) => item._id);
  const annotationIds = plan.annotations.map((item) => item._id);
  const voteIds = plan.votes.map((item) => item._id);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const update of plan.coverUpdates) {
        await Series.updateOne(
          { _id: update.seriesId },
          {
            $set: {
              imageUrl: update.imageUrl,
            },
          },
          { session },
        );
      }

      for (const earning of plan.earnings) {
        const approvedPages = earning.approvedPages.filter((approvedPage) => (
          !idStrings(chapterIds).includes(String(approvedPage.chapterId))
          && !idStrings(pageIds).includes(String(approvedPage.pageId))
          && !idStrings(taskIds).includes(String(approvedPage.taskId))
        ));
        await Earning.updateOne(
          { _id: earning._id },
          {
            $set: {
              approvedPages,
              totalPagesApproved: approvedPages.length,
              totalEarning: approvedPages.length * earning.ratePerPage,
            },
          },
          { session },
        );
      }

      if (voteIds.length) await Vote.deleteMany({ _id: { $in: voteIds } }, { session });
      if (submissionIds.length) {
        await Submission.deleteMany({ _id: { $in: submissionIds } }, { session });
      }
      if (annotationIds.length) {
        await Annotation.deleteMany({ _id: { $in: annotationIds } }, { session });
      }
      if (notificationIds.length) {
        await Notification.deleteMany({ _id: { $in: notificationIds } }, { session });
      }
      if (fileIds.length) await File.deleteMany({ _id: { $in: fileIds } }, { session });
      if (taskIds.length) await Task.deleteMany({ _id: { $in: taskIds } }, { session });
      if (pageIds.length) await Page.deleteMany({ _id: { $in: pageIds } }, { session });
      if (chapterIds.length) {
        await Chapter.deleteMany({ _id: { $in: chapterIds } }, { session });
      }
    });
  } finally {
    await session.endSession();
  }
}

async function validateRepair() {
  const plan = await collectRepairPlan();
  const remainingToDelete = plan.chaptersToDelete.length + plan.pagesToDelete.length;
  if (remainingToDelete !== 0) {
    throw new Error(`Repair validation failed: ${remainingToDelete} invalid records remain.`);
  }

  return plan.summary;
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing from .env');

  const shouldApply = process.argv.includes('--apply');
  const isRemote = !/mongodb:\/\/(localhost|127\.0\.0\.1)/i.test(process.env.MONGODB_URI);
  if (shouldApply && isRemote && !process.argv.includes('--confirm-remote')) {
    throw new Error('Remote MongoDB detected. Add --confirm-remote after reviewing dry-run output.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const plan = await collectRepairPlan();
  printPlan(plan);

  if (!shouldApply) {
    console.log('Dry run only. No database records were changed.');
    return;
  }

  const backupPath = createBackup(plan);
  console.log('Backup written:', backupPath);
  await applyRepair(plan);
  console.table(await validateRepair());
  console.log('Catalogue repair completed successfully.');
}

main()
  .catch((error) => {
    console.error('Catalogue repair failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
