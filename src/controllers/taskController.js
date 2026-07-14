const Task = require('../models/Task.js');
const Page = require('../models/Page.js');
const User = require('../models/User.js');
const Series = require('../models/Series.js');
const Chapter = require('../models/Chapter.js');
const AssistantEarning = require('../models/AssistantEarning.js');
const { logAction } = require('../utils/auditLogger');

exports.createTask = async (req, res) => {
  try {
    const {
      seriesId,
      chapterId,
      assignedTo,
      title,
      description,
      pageIds,
      dueAt,
      regions,
      region,
      sourceImageUrl,
    } = req.body;

    // Validate assignedTo user role
    const assistant = await User.findById(assignedTo);

    if (!assistant || assistant.role !== 'ASSISTANT' || assistant.isActive === false || assistant.deletedAt) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user must be an ASSISTANT',
      });
    }
    const chapter = await Chapter.findOne({ _id: chapterId, seriesId });
    if (!chapter) {
      return res.status(400).json({
        success: false,
        message: 'Chapter does not belong to the selected series',
      });
    }


    if (req.user.role === 'MANGAKA') {
      const ownsSeries = await Series.exists({ _id: seriesId, mangakaId: req.user._id });
      if (!ownsSeries) {
        return res.status(403).json({
          success: false,
          message: 'You can only assign tasks for your own series',
        });
      }
    }

    const resolvedPageIds = Array.isArray(pageIds) ? [...pageIds] : [];
    if (resolvedPageIds.length === 0 && sourceImageUrl) {
    if (
      sourceImageUrl &&
      !/^\/uploads\/[A-Za-z0-9._-]+$/.test(sourceImageUrl)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid source image URL',
      });
    }

      const latestPage = await Page.findOne({ chapterId }).sort({ pageNumber: -1 });
      const page = await Page.create({
        chapterId,
        pageNumber: (latestPage?.pageNumber || 0) + 1,
        imageUrl: sourceImageUrl,
        status: 'HAS_TASK',
      });
      resolvedPageIds.push(page._id);
    }

    if (resolvedPageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one page or a source image is required',
      });
    }

    const matchingPages = await Page.countDocuments({
      _id: { $in: resolvedPageIds },
      chapterId,
    });
    if (matchingPages !== resolvedPageIds.length) {
      return res.status(400).json({
        success: false,
        message: 'All task pages must belong to the selected chapter',
      });
    }

    const task = await Task.create({
      seriesId,
      chapterId,
      assignedTo,
      assignedBy: req.user._id,
      title,
      description,
      pageIds: resolvedPageIds,
      dueAt,
      regions: regions || (region ? [region] : []),
    });

    // Update assigned pages
    if (resolvedPageIds.length > 0) {
      await Page.updateMany(
        { _id: { $in: resolvedPageIds }, chapterId },
        { status: 'HAS_TASK' }
      );
    }

    // ==================== AUDIT LOG ====================
    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Assigned New Task",
      `Task: ${title}`,
      `Series: ${seriesId}, Chapter: ${chapterId}, Assistant: ${assignedTo}, Pages: ${resolvedPageIds.length}`
    );

    // Realtime Socket
    if (req.io) {
      req.io.emit('task_assigned', task);
    }

    res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.submitTask = async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        assignedTo: req.user._id,
        status: { $in: ['PENDING', 'IN_PROGRESS', 'REVISION_REQUESTED', 'REVISING'] },
      },
      {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      {
        new: true,
      }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found, not assigned to you, or not submittable',
      });
    }

    // Update page status
    await Page.updateMany(
      {
        _id: { $in: task.pageIds },
        status: { $ne: 'APPROVED' },
      },
      {
        status: 'COMPLETED',
      }
    );

    // ==================== AUDIT LOG ====================
    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Submitted Task",
      `Task ID: ${req.params.id}`,
      `Series: ${task.seriesId}, Chapter: ${task.chapterId}`
    );

    if (req.io) {
      req.io.emit('task_done', task);
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getMyTasks = async (req, res) => {
  try {
    const userId = req.user._id;

    let filter = {};

    if (req.user.role === 'ASSISTANT') {
      filter.assignedTo = userId;
    } else if (req.user.role === 'MANGAKA') {
      filter.assignedBy = userId;
    } else if (req.user.role === 'EDITOR') {
      const seriesIds = await Series.find({ editorId: userId }).distinct('_id');
      filter.seriesId = { $in: seriesIds };
    } else {
      filter = {
        $or: [
          { assignedTo: userId },
          { assignedBy: userId },
        ],
      };
    }

    const tasks = await Task.find(filter)
      .populate('seriesId', 'title')
      .populate('chapterId', 'chapterNumber')
      .populate('pageIds');

    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mangaka review assistant task
exports.reviewTask = async (req, res) => {
  try {
    const { action, reviewNote } = req.body;

    if (
      !['APPROVE', 'REJECT', 'REVISION_REQUESTED'].includes(action)
    ) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'APPROVE', 'REJECT', or 'REVISION_REQUESTED'",
      });
    }

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }
    const series = await Series.findById(task.seriesId).select('mangakaId editorId');
    if (req.user.role === 'MANGAKA' && task.assignedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only review tasks you assigned',
      });
    }
    if (
      req.user.role === 'EDITOR' &&
      (!series?.editorId || series.editorId.toString() !== req.user._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only review tasks for your assigned series',
      });
    }
    if (!['SUBMITTED', 'MANGAKA_APPROVED'].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: `Task cannot be reviewed from status ${task.status}`,
      });
    }

    if (action === 'APPROVE' && req.user.role === 'MANGAKA') {
      task.status = 'MANGAKA_APPROVED';
      task.reviewedAt = new Date();
      task.reviewNote = reviewNote || 'Approved by mangaka; awaiting editor approval';
      await task.save();

      await Page.updateMany(
        { _id: { $in: task.pageIds }, status: { $ne: 'APPROVED' } },
        {
          status: 'COMPLETED',
          reviewNote: task.reviewNote,
        },
      );
      await logAction(
        req.user._id,
        req.user.name || 'Unknown',
        'Mangaka Approved Task',
        `Task: ${task.title}`,
        `Awaiting editor approval. Review: ${reviewNote || 'No note'}`,
      );
      if (req.io) req.io.emit('task_mangaka_approved', task);
      return res.status(200).json({
        success: true,
        message: 'Task approved by mangaka and sent to editor',
        data: task,
      });
    }

    if (action === 'APPROVE' && req.user.role === 'EDITOR' && task.status !== 'MANGAKA_APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Mangaka approval is required before editor approval',
      });
    }


    if (action === 'APPROVE') {
      task.status = 'APPROVED';
      task.reviewedAt = new Date();
      task.reviewNote = reviewNote || 'Final approval';

      await task.save();

      await Page.updateMany(
        { _id: { $in: task.pageIds } },
        {
          status: 'APPROVED',
          reviewNote: reviewNote || 'Approved by author',
          approvedAt: new Date(),
        }
      );

      // Assistant earning logic (giữ nguyên)
      const pagesCount = task.pageIds.length;
      if (pagesCount > 0) {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        let earning = await AssistantEarning.findOne({
          assistantId: task.assignedTo,
          month: monthStr,
        });

        if (!earning) {
          earning = new AssistantEarning({
            assistantId: task.assignedTo,
            month: monthStr,
            totalPagesApproved: 0,
            ratePerPage: 50000,
            totalEarning: 0,
            approvedPages: [],
          });
        }

        const existingApprovedPageIds = earning.approvedPages.map(ap => ap.pageId.toString());
        let addedPagesCount = 0;

        for (const pageId of task.pageIds) {
          if (!existingApprovedPageIds.includes(pageId.toString())) {
            earning.approvedPages.push({
              pageId,
              chapterId: task.chapterId,
              seriesId: task.seriesId,
              approvedAt: new Date(),
            });
            addedPagesCount++;
          }
        }

        earning.totalPagesApproved += addedPagesCount;
        earning.totalEarning = earning.totalPagesApproved * earning.ratePerPage;

        await earning.save();
      }

      // ==================== AUDIT LOG ====================
      await logAction(
        req.user._id,
        req.user.name || 'Unknown',
        "Approved Task",
        `Task: ${task.title}`,
        `Pages approved: ${task.pageIds.length}, Review: ${reviewNote || 'No note'}`
      );

      if (req.io) {
        req.io.emit('task_approved', task);
      }
    } else {
      task.status = 'REVISION_REQUESTED';
      task.reviewedAt = new Date();
      task.reviewNote = reviewNote || 'Revision requested by author';

      await task.save();

      await Page.updateMany(
        {
          _id: { $in: task.pageIds },
          status: { $ne: 'APPROVED' },
        },
        {
          status: 'REVISION_REQUESTED',
          reviewNote: reviewNote || 'Revision requested by author',
        }
      );

      // ==================== AUDIT LOG ====================
      await logAction(
        req.user._id,
        req.user.name || 'Unknown',
        "Requested Task Revision",
        `Task: ${task.title}`,
        `Reason: ${reviewNote || 'No note provided'}`
      );

      if (req.io) {
        req.io.emit('task_revision_requested', task);
      }
    }

    res.status(200).json({
      success: true,
      message: `Task has been ${action === 'APPROVE' ? 'approved' : 'returned for revision'} successfully`,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};