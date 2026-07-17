const Task = require('../models/Task.js');
const Page = require('../models/Page.js');
const User = require('../models/User.js');
const Series = require('../models/Series.js');
const Chapter = require('../models/Chapter.js');
const AssistantEarning = require('../models/AssistantEarning.js');
const Notification = require('../models/Notification.js');
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

    // DEBUG: Log incoming request body
    console.log('[createTask] req.body =>', JSON.stringify({
      seriesId, chapterId, assignedTo, title, sourceImageUrl,
      pageIds, regions: regions?.length, region: !!region
    }));

    // Validate assignedTo user role
    const assistant = await User.findById(assignedTo);

    if (!assistant || assistant.role !== 'ASSISTANT' || assistant.isActive === false || assistant.deletedAt) {
      console.log('[createTask] FAIL: assistant check. assistant =>', assistant?._id, assistant?.role, assistant?.isActive);
      return res.status(400).json({
        success: false,
        message: 'Assigned user must be an ASSISTANT',
      });
    }

    // DEBUG: Check what's in the database for this chapter
    const chapterById = await Chapter.findById(chapterId);
    console.log('[createTask] chapterById =>', chapterById?._id, 'chapter.seriesId =>', chapterById?.seriesId?.toString(), 'requested seriesId =>', seriesId);

    const chapter = await Chapter.findOne({ _id: chapterId, seriesId });
    if (!chapter) {
      console.log('[createTask] FAIL: chapter does not belong to series. chapterId =>', chapterId, 'seriesId =>', seriesId);
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
      const isRelativeUpload = /^\/?(src\/)?uploads[/\\][A-Za-z0-9._-]+$/.test(sourceImageUrl);
      const isRemoteUrl = /^https?:\/\//.test(sourceImageUrl);
      if (sourceImageUrl && !isRelativeUpload && !isRemoteUrl) {
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

    const taskDueAt = dueAt ? new Date(dueAt) : (chapter.dueAt || new Date(Date.now() + 3 * 24 * 3600 * 1000));

    const task = await Task.create({
      seriesId,
      chapterId,
      assignedTo,
      assignedBy: req.user._id,
      title,
      description,
      pageIds: resolvedPageIds,
      dueAt: taskDueAt,
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

    // Create Notification for Assistant
    const notification = await Notification.create({
      userId: assignedTo,
      title: 'New Task Assigned',
      content: `You have been assigned a new task: "${title}".`,
      type: 'INFO',
    });

    // Realtime Socket
    if (req.io) {
      req.io.emit('task_assigned', task);
      req.io.emit('notification', notification);
    }

    // Populate for response
    const populatedTask = await Task.findById(task._id)
      .populate('seriesId', 'title')
      .populate('chapterId', 'chapterNumber title')
      .populate('assignedTo', 'name email')
      .populate('pageIds');

    res.status(201).json({
      success: true,
      data: populatedTask,
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

    // Notify Mangaka that Assistant submitted the task
    const notification = await Notification.create({
      userId: task.assignedBy,
      title: 'Task Submitted',
      content: `Assistant has submitted the task: "${task.title}". Please review it.`,
      type: 'INFO',
    });

    if (req.io) {
      req.io.emit('task_done', task);
      req.io.emit('notification', notification);
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
    if (!['SUBMITTED', 'MANGAKA_APPROVED', 'PENDING_REVIEW'].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: `Task cannot be reviewed from status ${task.status}`,
      });
    }


    if (action === 'APPROVE') {
      task.status = 'MANGAKA_APPROVED';
      task.reviewedAt = new Date();
      task.reviewNote = reviewNote || 'Approved by Mangaka';
      await task.save();

      await Page.updateMany(
        { _id: { $in: task.pageIds } },
        {
          status: 'APPROVED',
          reviewNote: reviewNote || 'Approved by author',
          approvedAt: new Date(),
        }
      );

      // Assistant earning logic
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

      const pagesCount = task.pageIds.length;
      let addedPagesCount = 0;

      if (pagesCount > 0) {
        // Calculate based on pages
        const existingApprovedPageIds = earning.approvedPages
          .filter(ap => ap.pageId)
          .map(ap => ap.pageId.toString());

        for (const pageId of task.pageIds) {
          if (!existingApprovedPageIds.includes(pageId.toString())) {
            earning.approvedPages.push({
              pageId,
              taskId: task._id,
              chapterId: task.chapterId,
              seriesId: task.seriesId,
              approvedAt: new Date(),
            });
            addedPagesCount++;
          }
        }
      } else {
        // Calculate based on task itself (treat as 1 work unit equivalent to 1 page)
        const isTaskAlreadyApproved = earning.approvedPages.some(
          ap => ap.taskId && ap.taskId.toString() === task._id.toString()
        );

        if (!isTaskAlreadyApproved) {
          earning.approvedPages.push({
            pageId: null,
            taskId: task._id,
            chapterId: task.chapterId,
            seriesId: task.seriesId,
            approvedAt: new Date(),
          });
          addedPagesCount = 1;
        }
      }

      if (addedPagesCount > 0) {
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

      // Notify Assistant that task was approved
      const approveNotification = await Notification.create({
        userId: task.assignedTo,
        title: 'Task Approved',
        content: `Your task "${task.title}" has been approved! ${reviewNote || ''}`,
        type: 'INFO',
      });

      if (req.io) {
        req.io.emit('task_approved', task);
        req.io.emit('notification', approveNotification);
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

      // Notify Assistant that revision is requested
      const revisionNotification = await Notification.create({
        userId: task.assignedTo,
        title: 'Task Revision Requested',
        content: `Your task "${task.title}" needs revision. Reason: ${reviewNote || 'No note provided'}`,
        type: 'WARNING',
      });

      if (req.io) {
        req.io.emit('task_revision_requested', task);
        req.io.emit('notification', revisionNotification);
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

// @desc    Get single task by ID
// @route   GET /api/tasks/:id
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('seriesId', 'title')
      .populate('chapterId', 'chapterNumber title')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .populate('pageIds');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
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