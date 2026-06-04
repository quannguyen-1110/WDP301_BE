const Annotation = require('../models/Annotation.js');
const Page = require('../models/Page.js');

// @desc    Create a new annotation on a page
// @route   POST /api/annotations
// @access  EDITOR, MANGAKA
exports.createAnnotation = async (req, res) => {
  try {
    const { pageId, coords, content, type } = req.body;

    if (!pageId || !coords || !content || !type) {
      return res.status(400).json({
        success: false,
        message: 'Please provide pageId, coords, content, and type',
      });
    }

    // Verify page exists
    const page = await Page.findById(pageId);
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    const annotation = await Annotation.create({
      pageId,
      annotatorId: req.user._id,
      coords,
      content,
      type,
    });

    // Populate annotator info
    await annotation.populate('annotatorId', 'name email role');

    // Notify via socket
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
// @route   GET /api/annotations/page/:pageId
// @access  EDITOR, MANGAKA, ASSISTANT
exports.getAnnotationsByPage = async (req, res) => {
  try {
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
// @route   PUT /api/annotations/:id
// @access  EDITOR, MANGAKA
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

    // Ensure they are the annotator or an Editor
    if (annotation.annotatorId.toString() !== req.user._id.toString() && req.user.role !== 'EDITOR') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this annotation',
      });
    }

    // Update fields
    if (coords) annotation.coords = coords;
    if (content) annotation.content = content;
    if (type) annotation.type = type;

    await annotation.save();
    await annotation.populate('annotatorId', 'name email role');

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
// @route   DELETE /api/annotations/:id
// @access  EDITOR, MANGAKA
exports.deleteAnnotation = async (req, res) => {
  try {
    const annotation = await Annotation.findById(req.params.id);
    if (!annotation) {
      return res.status(404).json({
        success: false,
        message: 'Annotation not found',
      });
    }

    // Ensure they are the annotator or an Editor
    if (annotation.annotatorId.toString() !== req.user._id.toString() && req.user.role !== 'EDITOR') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this annotation',
      });
    }

    await annotation.deleteOne();

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
