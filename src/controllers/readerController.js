const Chapter = require('../models/Chapter');
const Page = require('../models/Page');
const Series = require('../models/Series');

const readableSeriesFilter = {
  isCatalogFeatured: true,
  status: { $nin: ['REJECTED', 'CANCELLED'] },
};

const readableChapterFilter = { status: 'PUBLISHED' };

const seriesFields = [
  'title', 'synopsis', 'genre', 'tags', 'originalTitle', 'localizedTitle',
  'originalAuthor', 'publicationYear', 'imageUrl', 'bannerUrl', 'status',
  'pubSchedule',
].join(' ');

async function pageCountsForChapters(chapterIds) {
  if (!chapterIds.length) return new Map();
  const counts = await Page.aggregate([
    { $match: { chapterId: { $in: chapterIds } } },
    { $group: { _id: '$chapterId', count: { $sum: 1 } } },
  ]);
  return new Map(counts.map((item) => [String(item._id), item.count]));
}

function serializeSeries(series, chapters, pageCounts) {
  const readableChapters = chapters.filter(
    (chapter) => (pageCounts.get(String(chapter._id)) || 0) > 0,
  );
  return {
    ...series,
    chapterCount: readableChapters.length,
    pageCount: readableChapters.reduce(
      (total, chapter) => total + (pageCounts.get(String(chapter._id)) || 0),
      0,
    ),
    latestChapter: readableChapters.at(-1)?.chapterNumber || null,
  };
}

exports.getCatalogue = async (req, res) => {
  try {
    const series = await Series.find(readableSeriesFilter)
      .select(seriesFields)
      .sort({ isCatalogFeatured: -1, title: 1 })
      .lean();
    const seriesIds = series.map((item) => item._id);
    const chapters = await Chapter.find({
      seriesId: { $in: seriesIds }, ...readableChapterFilter,
    })
      .select('seriesId chapterNumber status publishedAt')
      .sort({ chapterNumber: 1 })
      .lean();
    const pageCounts = await pageCountsForChapters(
      chapters.map((chapter) => chapter._id),
    );
    const chaptersBySeries = new Map();
    chapters.forEach((chapter) => {
      const key = String(chapter.seriesId);
      chaptersBySeries.set(key, [...(chaptersBySeries.get(key) || []), chapter]);
    });
    const data = series.map((item) => serializeSeries(
      item,
      chaptersBySeries.get(String(item._id)) || [],
      pageCounts,
    ));
    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSeries = async (req, res) => {
  try {
    const series = await Series.findOne({
      _id: req.params.id, ...readableSeriesFilter,
    }).select(seriesFields).lean();
    if (!series) {
      return res.status(404).json({ success: false, message: 'Series not found' });
    }
    const chapters = await Chapter.find({
      seriesId: series._id, ...readableChapterFilter,
    })
      .select('seriesId chapterNumber title status publishedAt createdAt')
      .sort({ chapterNumber: 1 })
      .lean();
    const pageCounts = await pageCountsForChapters(
      chapters.map((chapter) => chapter._id),
    );
    return res.status(200).json({
      success: true,
      data: {
        ...serializeSeries(series, chapters, pageCounts),
        chapters: chapters.map((chapter) => ({
          ...chapter,
          pageCount: pageCounts.get(String(chapter._id)) || 0,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getChapter = async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.id).lean();
    if (!chapter || chapter.status !== 'PUBLISHED') {
      return res.status(404).json({ success: false, message: 'Chapter not found' });
    }
    const series = await Series.findOne({
      _id: chapter.seriesId, ...readableSeriesFilter,
    }).select('title originalTitle localizedTitle imageUrl').lean();
    if (!series) {
      return res.status(404).json({ success: false, message: 'Series not found' });
    }
    const pages = await Page.find({ chapterId: chapter._id })
      .select('pageNumber imageUrl')
      .sort({ pageNumber: 1 })
      .lean();
    return res.status(200).json({
      success: true,
      data: { ...chapter, series, pages },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

