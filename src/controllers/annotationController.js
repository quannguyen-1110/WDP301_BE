const mongoose = require('mongoose');
const Annotation = require('../models/Annotation.js');
const Page = require('../models/Page.js');
const Chapter = require('../models/Chapter.js');
const Series = require('../models/Series.js');
const Task = require('../models/Task.js');
const { logAction } = require('../utils/auditLogger');

const canManagePage = async (user, pageId) => {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'BOARD_MEMBER') return true;
  if (user.role === 'ASSISTANT') return Boolean(await Task.exists({ assignedTo: user._id, pageIds: pageId }));
  const page = await Page.findById(pageId).select('chapterId');
  if (!page) return false;
  const chapter = await Chapter.findById(page.chapterId).select('seriesId');
  if (!chapter) return false;
  if (user.role === 'MANGAKA') {
    return Boolean(await Series.exists({ _id: chapter.seriesId, mangakaId: user._id }));
  }
  if (user.role === 'EDITOR') {
    return Boolean(await Series.exists({ _id: chapter.seriesId, editorId: user._id }));
  }
  return false;
};

// @desc    Create a new annotation on a page
exports.createAnnotation = async (req, res) => {
  try {
    const { pageId, coords, content, type } = req.body;

    if (!pageId || !coords || !content || !type) {
      return res.status(400).json({
        success: false,
        message: 'Please provide pageId, coords, content, and type',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(pageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pageId format',
      });
    }

    const page = await Page.findById(pageId);
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    if (!(await canManagePage(req.user, page._id))) {
      return res.status(403).json({
        success: false,
        message: 'You cannot annotate pages outside your managed series',
      });
    }

    const annotation = await Annotation.create({
      pageId,
      annotatorId: req.user._id,
      coords,
      content,
      type,
    });

    await annotation.populate('annotatorId', 'name email role');

    // ==================== AUDIT LOG ====================
    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Created Annotation",
      `Page ID: ${pageId}`,
      `Type: ${type} - ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`
    );

    if (req.io) {
      req.io.emit('annotation_created', annotation);
    }

    res.status(201).json({
      success: true,
      data: annotation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all annotations for a specific page
exports.getAnnotationsByPage = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.pageId)) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
      });
    }

    if (!(await canManagePage(req.user, req.params.pageId))) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to annotations for this page',
      });
    }

    const annotations = await Annotation.find({ pageId: req.params.pageId })
      .populate('annotatorId', 'name email role')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: annotations.length,
      data: annotations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update an annotation
exports.updateAnnotation = async (req, res) => {
  try {
    const { coords, content, type } = req.body;
    
    let annotation = await Annotation.findById(req.params.id);
    if (!annotation) {
      return res.status(404).json({
        success: false,
        message: 'Annotation not found',
      });
    }

    const ownsAnnotation = annotation.annotatorId.toString() === req.user._id.toString();
    if (!ownsAnnotation && !(await canManagePage(req.user, annotation.pageId))) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this annotation',
      });
    }

    if (coords) annotation.coords = coords;
    if (content) annotation.content = content;
    if (type) annotation.type = type;

    await annotation.save();
    await annotation.populate('annotatorId', 'name email role');

    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Updated Annotation",
      `Annotation ID: ${req.params.id}`,
      `Page ID: ${annotation.pageId}`
    );

    if (req.io) {
      req.io.emit('annotation_updated', annotation);
    }

    res.status(200).json({
      success: true,
      data: annotation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete an annotation
exports.deleteAnnotation = async (req, res) => {
  try {
    const annotation = await Annotation.findById(req.params.id);
    if (!annotation) {
      return res.status(404).json({
        success: false,
        message: 'Annotation not found',
      });
    }

    const ownsAnnotation = annotation.annotatorId.toString() === req.user._id.toString();
    if (!ownsAnnotation && !(await canManagePage(req.user, annotation.pageId))) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this annotation',
      });
    }

    await annotation.deleteOne();

    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Deleted Annotation",
      `Annotation ID: ${req.params.id}`,
      `Page ID: ${annotation.pageId}`
    );

    if (req.io) {
      req.io.emit('annotation_deleted', { id: req.params.id, pageId: annotation.pageId });
    }

    res.status(200).json({
      success: true,
      message: 'Annotation deleted successfully',
      data: { id: req.params.id },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};