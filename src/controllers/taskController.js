const Task = require('../models/Task.js');
const Page = require('../models/Page.js');
const User = require('../models/User.js');
const Series = require('../models/Series.js');
const Chapter = require('../models/Chapter.js');
const AssistantEarning = require('../models/AssistantEarning.js');
const Notification = require('../models/Notification.js');
const { logAction } = require('../utils/auditLogger');
const { normalizeUrl, normalizePageImageUrls } = require('../utils/helpers.js');

exports.createTask = async (req, res) => {
  try {
    const {
      seriesId,
      chapterId,
      assignedTo,
      title,
      type,
      description,
      pageIds,
      dueAt,
      regions,
      region,
      sourceImageUrl,
    } = req.body;

    if (!seriesId || !chapterId || !assignedTo || !title?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Series, chapter, assistant, and task title are required',
      });
    }

    const normalizedRegions = Array.isArray(regions)
      ? regions
      : (region ? [region] : []);

    if (normalizedRegions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one work region is required',
      });
    }

    const invalidRegion = normalizedRegions.some((item) => {
      const values = [item?.x, item?.y, item?.width, item?.height];
      return values.some((value) => !Number.isFinite(Number(value))) ||
        Number(item.x) < 0 || Number(item.y) < 0 ||
        Number(item.width) <= 0 || Number(item.height) <= 0 ||
        Number(item.x) + Number(item.width) > 100 ||
        Number(item.y) + Number(item.height) > 100;
    });

    if (invalidRegion) {
      return res.status(400).json({
        success: false,
        message: 'Work regions must stay inside the page bounds',
      });
    }

    if (dueAt && Number.isNaN(new Date(dueAt).getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task deadline',
      });
    }

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
      const isRelativeUpload = /^\/?(src\/)?uploads[/\\][A-Za-z0-9._-]+$/.test(sourceImageUrl);
      const isRemoteUrl = /^https?:\/\//.test(sourceImageUrl);
      if (sourceImageUrl && !isRelativeUpload && !isRemoteUrl) {
        return res.status(400).json({
          success: false,
          message: 'Invalid source image URL',
        });
      }

      // Normalize the sourceImageUrl to an absolute URL before saving
      const normalizedImageUrl = normalizeUrl(sourceImageUrl, req);

      const latestPage = await Page.findOne({ chapterId }).sort({ pageNumber: -1 });
      const page = await Page.create({
        chapterId,
        pageNumber: (latestPage?.pageNumber || 0) + 1,
        imageUrl: normalizedImageUrl,
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (taskDueAt < today) {
      return res.status(400).json({
        success: false,
        message: 'Task deadline cannot be in the past',
      });
    }
    if (chapter.dueAt && taskDueAt > chapter.dueAt) {
      return res.status(400).json({
        success: false,
        message: 'Task deadline cannot be later than the chapter deadline',
      });
    }

    const task = await Task.create({
      seriesId,
      chapterId,
      assignedTo,
      assignedBy: req.user._id,
      title: title.trim(),
      type,
      description,
      pageIds: resolvedPageIds,
      dueAt: taskDueAt,
      regions: normalizedRegions,
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
      taskId: task._id,
      chapterId: task.chapterId,
      seriesId: task.seriesId,
    });

    // Realtime Socket
    if (req.io) {
      req.io.to(assignedTo.toString()).emit('notification', notification);
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

    // ── Optional filters by seriesId / chapterId query params ──
    if (req.query.seriesId) {
      filter.seriesId = req.query.seriesId;
    }
    if (req.query.chapterId) {
      filter.chapterId = req.query.chapterId;
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

    if (
      (action === 'REVISION_REQUESTED' || action === 'REJECT') &&
      !reviewNote?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'A revision reason is required',
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
    const isMangakaReview = req.user.role === 'MANGAKA';
    const isEditorReview = ['EDITOR', 'ADMIN'].includes(req.user.role);
    if (isMangakaReview && !['SUBMITTED', 'PENDING_REVIEW'].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: 'The Assistant must submit the task before Mangaka review',
      });
    }
    if (isEditorReview && task.status !== 'MANGAKA_APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Mangaka approval is required before Tantou Editor review',
      });
    }


    if (action === 'APPROVE' && req.user.role === 'MANGAKA') {
      if (!['SUBMITTED', 'PENDING_REVIEW'].includes(task.status)) {
        return res.status(400).json({
          success: false,
          message: 'The Assistant must submit the task before Mangaka review',
        });
      }

      task.status = 'MANGAKA_APPROVED';
      task.reviewedAt = new Date();
      task.reviewNote = reviewNote || 'Approved by Mangaka (Round 1)';
      task.reviewHistory.push({
        reviewerId: req.user._id,
        reviewerRole: req.user.role,
        action: 'APPROVE',
        note: task.reviewNote,
      });
      await task.save();

      await Page.updateMany(
        { _id: { $in: task.pageIds }, status: { $ne: 'APPROVED' } },
        {
          status: 'COMPLETED',
          reviewNote: task.reviewNote,
        }
      );

      await logAction(
        req.user._id,
        req.user.name || 'Unknown',
        'Mangaka Approved Task',
        `Task: ${task.title}`,
        `Awaiting final Editor approval. Review: ${reviewNote || 'No note'}`
      );

      const approveNotification = await Notification.create({
        userId: task.assignedTo,
        title: 'Task Approved by Mangaka (Round 1)',
        content: `Your task "${task.title}" has been approved by Mangaka and sent for Editor final review.`,
        type: 'INFO',
        taskId: task._id,
        chapterId: task.chapterId,
        seriesId: task.seriesId,
      });

      const remainingMangakaReviews = await Task.countDocuments({
        chapterId: task.chapterId,
        status: { $nin: ['MANGAKA_APPROVED', 'APPROVED'] },
      });

      let editorNotification = null;
      if (remainingMangakaReviews === 0) {
        const transitionedChapter = await Chapter.findOneAndUpdate(
          {
            _id: task.chapterId,
            status: { $ne: 'UNDER_REVIEW' },
          },
          { status: 'UNDER_REVIEW' },
          { new: true }
        );

        if (transitionedChapter && series?.editorId) {
          editorNotification = await Notification.create({
            userId: series.editorId,
            title: 'Chapter Ready for Final Review',
            content: `All production tasks in the chapter have passed Mangaka review.`,
            type: 'INFO',
            taskId: task._id,
            chapterId: task.chapterId,
            seriesId: task.seriesId,
          });
        }
      }

      if (req.io) {
        req.io.to(task.assignedTo.toString()).emit('notification', approveNotification);
        if (editorNotification) {
          req.io.to(series.editorId.toString()).emit('notification', editorNotification);
        }
        req.io.emit('task_mangaka_approved', task);
        req.io.emit('notification', approveNotification);
        if (editorNotification) req.io.emit('notification', editorNotification);
      }

      return res.status(200).json({
        success: true,
        message: 'Task approved by Mangaka (Round 1); awaiting Editor approval',
        data: task,
      });
    }

    if (action === 'APPROVE' && (req.user.role === 'EDITOR' || req.user.role === 'ADMIN')) {
      if (task.status !== 'MANGAKA_APPROVED') {
        return res.status(400).json({
          success: false,
          message: 'Mangaka approval (Round 1) is required before Editor final approval',
        });
      }

      task.status = 'APPROVED';
      task.reviewedAt = new Date();
      task.reviewNote = reviewNote || 'Final approval by Editor';
      task.reviewHistory.push({
        reviewerId: req.user._id,
        reviewerRole: req.user.role,
        action: 'APPROVE',
        note: task.reviewNote,
      });

      await task.save();

      await Page.updateMany(
        { _id: { $in: task.pageIds } },
        {
          status: 'APPROVED',
          reviewNote: reviewNote || 'Approved by Editor',
          approvedAt: new Date(),
        }
      );

      // Assistant earning logic - ONLY calculated upon Editor Final Approval!
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

      // Notify Assistant that task was final approved
      const approveNotification = await Notification.create({
        userId: task.assignedTo,
        title: 'Task Final Approved by Editor',
        content: `Your task "${task.title}" has received final approval from Editor! Earnings recorded. ${reviewNote || ''}`,
        type: 'INFO',
        taskId: task._id,
        chapterId: task.chapterId,
        seriesId: task.seriesId,
      });

      const remainingFinalReviews = await Task.countDocuments({
        chapterId: task.chapterId,
        status: { $ne: 'APPROVED' },
      });

      let readyNotification = null;
      if (remainingFinalReviews === 0) {
        const transitionedChapter = await Chapter.findOneAndUpdate(
          {
            _id: task.chapterId,
            status: { $ne: 'SENT_TO_EDITORIAL' },
          },
          { status: 'SENT_TO_EDITORIAL' },
          { new: true }
        );

        if (transitionedChapter) {
          readyNotification = await Notification.create({
            userId: task.assignedBy,
            title: 'Chapter Ready for Publication Review',
            content: 'All chapter tasks passed Tantou Editor final review and were sent to the Editorial Board queue.',
            type: 'INFO',
            taskId: task._id,
            chapterId: task.chapterId,
            seriesId: task.seriesId,
          });
        }
      }

      if (req.io) {
        req.io.to(task.assignedTo.toString()).emit('notification', approveNotification);
        if (readyNotification) {
          req.io.to(task.assignedBy.toString()).emit('notification', readyNotification);
        }
        req.io.emit('task_approved', task);
        req.io.emit('notification', approveNotification);
        if (readyNotification) req.io.emit('notification', readyNotification);
      }

      return res.status(200).json({
        success: true,
        message: remainingFinalReviews === 0
          ? 'Task approved; chapter is ready for Editorial Board publication review'
          : 'Task received final approval from Editor',
        data: task,
      });
    }

    if (action === 'REVISION_REQUESTED' || action === 'REJECT') {
      task.status = 'REVISION_REQUESTED';
      task.reviewedAt = new Date();
      task.reviewNote = reviewNote.trim();
      task.reviewHistory.push({
        reviewerId: req.user._id,
        reviewerRole: req.user.role,
        action: 'REVISION_REQUESTED',
        note: task.reviewNote,
      });

      await task.save();

      await Chapter.findByIdAndUpdate(task.chapterId, { status: 'REVISION_REQUESTED' });

      await Page.updateMany(
        {
          _id: { $in: task.pageIds },
          status: { $ne: 'APPROVED' },
        },
        {
          status: 'REVISION_REQUESTED',
          reviewNote: task.reviewNote,
        }
      );

      const revisionNotification = await Notification.create({
        userId: task.assignedTo,
        title: `Task Revision Requested by ${req.user.role === 'MANGAKA' ? 'Mangaka' : 'Tantou Editor'}`,
        content: `Revision requested for task "${task.title}": ${task.reviewNote}`,
        type: 'WARNING',
        taskId: task._id,
        chapterId: task.chapterId,
        seriesId: task.seriesId,
      });

      let mangakaNotification = null;
      if (req.user.role === 'EDITOR' || req.user.role === 'ADMIN') {
        mangakaNotification = await Notification.create({
          userId: task.assignedBy,
          title: 'Tantou Editor Requested Revision',
          content: `Task "${task.title}" was returned for revision: ${task.reviewNote}`,
          type: 'WARNING',
          taskId: task._id,
          chapterId: task.chapterId,
          seriesId: task.seriesId,
        });
      }

      if (req.io) {
        req.io.to(task.assignedTo.toString()).emit('notification', revisionNotification);
        if (mangakaNotification) {
          req.io.to(task.assignedBy.toString()).emit('notification', mangakaNotification);
        }
        req.io.emit('task_revision_requested', task);
        req.io.emit('notification', revisionNotification);
        if (mangakaNotification) req.io.emit('notification', mangakaNotification);
      }

      return res.status(200).json({
        success: true,
        message: 'Revision requested successfully',
        data: task,
      });
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