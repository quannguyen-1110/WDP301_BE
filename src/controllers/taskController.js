const Task = require('../models/Task.js');
const Page = require('../models/Page.js');
const User = require('../models/User.js');
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
    } = req.body;

    // Validate assignedTo user role
    const assistant = await User.findById(assignedTo);

    if (!assistant || assistant.role !== 'ASSISTANT') {
      return res.status(400).json({
        success: false,
        message: 'Assigned user must be an ASSISTANT',
      });
    }

    const task = await Task.create({
      seriesId,
      chapterId,
      assignedTo,
      assignedBy: req.user._id,
      title,
      description,
      pageIds: pageIds || [],
      dueAt,
      regions: regions || [],
    });

    // Update assigned pages
    if (pageIds && pageIds.length > 0) {
      await Page.updateMany(
        { _id: { $in: pageIds } },
        { status: 'HAS_TASK' }
      );
    }

    // ==================== AUDIT LOG ====================
    await logAction(
      req.user._id,
      req.user.name || 'Unknown',
      "Assigned New Task",
      `Task: ${title}`,
      `Series: ${seriesId}, Chapter: ${chapterId}, Assistant: ${assignedTo}, Pages: ${pageIds?.length || 0}`
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
    const task = await Task.findByIdAndUpdate(
      req.params.id,
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
        message: 'Task not found',
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

    if (action === 'APPROVE') {
      task.status = 'APPROVED';
      task.reviewedAt = new Date();
      task.reviewNote = reviewNote || 'Approved by author';

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