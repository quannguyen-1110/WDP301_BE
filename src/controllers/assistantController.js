const Task = require('../models/Task.js');
const Page = require('../models/Page.js');
const Chapter = require('../models/Chapter.js');
const AssistantEarning = require('../models/AssistantEarning.js');
const Series = require('../models/Series.js');
const User = require('../models/User.js');
const Notification = require('../models/Notification.js');
const { generateAssistantPageArt } = require('../services/assistantJobService.js');
const { normalizeUrl, normalizePageImageUrls } = require('../utils/helpers.js');

const syncChapterAfterSubmission = async (chapterId) => {
  const unfinishedTaskCount = await Task.countDocuments({
    chapterId,
    status: {
      $nin: ['SUBMITTED', 'MANGAKA_APPROVED', 'APPROVED'],
    },
  });

  if (unfinishedTaskCount === 0) {
    await Chapter.findByIdAndUpdate(chapterId, {
      status: 'SUBMITTED',
    });
  }
};

// @desc    Get current assistant's assigned tasks
// @route   GET /api/assistant/my-tasks
// @access  ASSISTANT
exports.getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id })
      .populate('seriesId', 'title imageUrl')
      .populate('chapterId', 'title chapterNumber')
      .populate('pageIds', 'pageNumber imageUrl assistantImageUrl status')
      .sort({ createdAt: -1 });

    // Normalize all image URLs in pages so the assistant can view them
    const normalizedTasks = tasks.map((task) => {
      const taskObj = task.toObject ? task.toObject() : { ...task };
      if (taskObj.pageIds && Array.isArray(taskObj.pageIds)) {
        taskObj.pageIds = taskObj.pageIds.map((page) =>
          normalizePageImageUrls(page, req)
        );
      }
      // Also normalize series imageUrl if present
      if (taskObj.seriesId && taskObj.seriesId.imageUrl) {
        taskObj.seriesId.imageUrl = normalizeUrl(taskObj.seriesId.imageUrl, req);
      }
      return taskObj;
    });

    res.status(200).json({
      success: true,
      count: normalizedTasks.length,
      data: normalizedTasks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get pages & resources for a specific task
// @route   GET /api/assistant/tasks/:taskId/pages
// @access  ASSISTANT
exports.getTaskPages = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      assignedTo: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or not assigned to you',
      });
    }

    let pages = await Page.find({ _id: { $in: task.pageIds } })
      .sort({ pageNumber: 1 });

    // Normalize all page image URLs so the assistant can view them
    const normalizedPages = pages.map((page) => normalizePageImageUrls(page, req));

    res.status(200).json({
      success: true,
      count: pages.length,
      data: {
        task,
        pages: normalizedPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Upload processed page artwork (assistant result)
// @route   PUT /api/assistant/pages/:pageId/upload
// @access  ASSISTANT
exports.uploadPageResult = async (req, res) => {
  try {
    const { assistantImageUrl, note } = req.body;

    if (!assistantImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide assistantImageUrl',
      });
    }

    // Find the page
    const page = await Page.findById(req.pageId || req.params.pageId);
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    // Find the task associated with this page to ensure ownership
    const task = await Task.findOne({
      pageIds: page._id,
      assignedTo: req.user._id,
    });

    if (!task) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to the task containing this page',
      });
    }

    // Normalize assistantImageUrl if relative
    let finalUrl = assistantImageUrl;
    if (finalUrl && !finalUrl.startsWith('http') && !finalUrl.startsWith('data:')) {
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const cleanPath = finalUrl.startsWith('/') ? finalUrl : `/${finalUrl}`;
      finalUrl = `${protocol}://${host}${cleanPath}`;
    }

    // Update the page
    page.assistantImageUrl = finalUrl;
    page.status = 'IN_PROGRESS';
    if (note !== undefined) {
      page.note = note;
    }
    await page.save();

    // Uploading a new result starts or resumes the assigned work.
    if (['PENDING', 'REVISION_REQUESTED', 'REVISING'].includes(task.status)) {
      task.status = 'IN_PROGRESS';
      await task.save();
      if (req.io) {
        req.io.emit('task_in_progress', task);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Page artwork uploaded successfully',
      data: page,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Submit a task for review
// @route   PUT /api/assistant/tasks/:taskId/submit
// @access  ASSISTANT
exports.submitTask = async (req, res) => {
  try {
    const taskId = req.params.taskId || req.params.id;
    const task = await Task.findOne({
      _id: taskId,
      assignedTo: req.user._id,
      status: { $in: ['PENDING', 'IN_PROGRESS', 'REVISION_REQUESTED', 'REVISING'] },
    }).populate('pageIds');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or not assigned to you',
      });
    }

    // ======== BACKEND AUTO: download -> crop -> upload -> set assistantImageUrl ========
    const pages = task.pageIds || [];

    let resultsByPageId = {};
    if (req.body?.assistantImageUrl) {
      for (const page of pages) {
        resultsByPageId[String(page._id)] = req.body.assistantImageUrl;
      }
    } else {
      try {
        resultsByPageId = await generateAssistantPageArt({
          task,
          pages,
          regionType: 'regions',
        });
      } catch (cropErr) {
        console.warn('generateAssistantPageArt fallback:', cropErr.message);
        for (const page of pages) {
          resultsByPageId[String(page._id)] = page.imageUrl || '';
        }
      }
    }

    // Update each page with assistantImageUrl
    let updatedCount = 0;
    for (const page of pages) {
      let newUrl = resultsByPageId[String(page._id)] || page.assistantImageUrl || page.imageUrl || '';
      if (newUrl && !newUrl.startsWith('http') && !newUrl.startsWith('data:')) {
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost:3000';
        const cleanPath = newUrl.startsWith('/') ? newUrl : `/${newUrl}`;
        newUrl = `${protocol}://${host}${cleanPath}`;
      }
      page.assistantImageUrl = newUrl;
      page.status = 'COMPLETED';
      await page.save();
      updatedCount++;
    }

    if (updatedCount !== pages.length) {
      return res.status(400).json({
        success: false,
        message: `Not all pages were processed successfully. updated=${updatedCount}, total=${pages.length}`,
      });
    }

    // Update task
    task.status = 'SUBMITTED';
    task.submittedAt = new Date();
    await task.save();

    // Update all pages inside this task that are not yet APPROVED to COMPLETED
    await Page.updateMany(
      {
        _id: { $in: task.pageIds },
        status: { $ne: 'APPROVED' },
      },
      {
        status: 'COMPLETED',
      }
    );

    await syncChapterAfterSubmission(task.chapterId);

    // Fetch updated task with populated details for event/response
    const populatedTask = await Task.findById(task._id)
      .populate('seriesId', 'title')
      .populate('chapterId', 'chapterNumber');

    // Create Notification for Mangaka (assignedBy)
    const notification = await Notification.create({
      userId: task.assignedBy,
      title: 'Task Submitted for Review',
      content: `Assistant ${req.user.name || 'Assistant'} has submitted the task "${task.title}". Please review it.`,
      type: 'INFO',
      isRead: false,
      taskId: task._id,
      chapterId: task.chapterId,
      seriesId: task.seriesId,
    });

    if (req.io) {
      req.io.to(task.assignedBy.toString()).emit('notification', notification);
      req.io.emit('notification', notification);
      req.io.emit('task_done', populatedTask);
    }

    res.status(200).json({
      success: true,
      message: 'Task submitted for review successfully',
      data: populatedTask,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get earnings tracking
// @route   GET /api/assistant/earnings
// @access  ASSISTANT
exports.getEarnings = async (req, res) => {
  try {
    const query = { assistantId: req.user._id };
    if (req.query.month) {
      query.month = req.query.month; // format: "YYYY-MM"
    }

    const earnings = await AssistantEarning.find(query)
      .populate('approvedPages.pageId', 'pageNumber imageUrl assistantImageUrl')
      .populate('approvedPages.taskId', 'title')
      .populate('approvedPages.chapterId', 'chapterNumber title')
      .populate('approvedPages.seriesId', 'title')
      .sort({ month: -1 });

    res.status(200).json({
      success: true,
      count: earnings.length,
      data: earnings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get details of earnings for a specific month
// @route   GET /api/assistant/earnings/:month
// @access  ASSISTANT
exports.getEarningDetail = async (req, res) => {
  try {
    const earning = await AssistantEarning.findOne({
      assistantId: req.user._id,
      month: req.params.month, // format: "YYYY-MM"
    })
    .populate('approvedPages.pageId', 'pageNumber imageUrl assistantImageUrl')
    .populate('approvedPages.taskId', 'title')
    .populate('approvedPages.chapterId', 'chapterNumber title')
    .populate('approvedPages.seriesId', 'title');

    if (!earning) {
      return res.status(404).json({
        success: false,
        message: `No earnings found for month ${req.params.month}`,
      });
    }

    res.status(200).json({
      success: true,
      data: earning,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get stats summary for assistant
// @route   GET /api/assistant/stats
// @access  ASSISTANT
exports.getStats = async (req, res) => {
  try {
    // 1. Calculate totals from earnings records
    const earnings = await AssistantEarning.find({ assistantId: req.user._id });
    
    let totalPagesApproved = 0;
    let totalEarning = 0;
    
    earnings.forEach(record => {
      totalPagesApproved += record.totalPagesApproved;
      totalEarning += record.totalEarning;
    });

    // 2. Count tasks by status
    const tasks = await Task.find({ assignedTo: req.user._id });
    
    let pendingTasksCount = 0;
    let submittedTasksCount = 0;
    let approvedTasksCount = 0;

    tasks.forEach(task => {
      if (task.status === 'PENDING' || task.status === 'IN_PROGRESS' || task.status === 'REVISION_REQUESTED') {
        pendingTasksCount++;
      } else if (task.status === 'SUBMITTED') {
        submittedTasksCount++;
      } else if (task.status === 'APPROVED') {
        approvedTasksCount++;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalPagesApproved,
        totalEarning,
        pendingTasksCount,
        submittedTasksCount,
        approvedTasksCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// @desc Get income dashboard tasks
// @route GET /api/assistant/income/tasks
// @access ASSISTANT
exports.getIncomeTasks = async (req, res) => {
  try {
    const earnings = await AssistantEarning.find({
      assistantId: req.user._id,
    })
    .populate('approvedPages.seriesId', 'title')
    .populate('approvedPages.taskId', 'title');

    let totalEarnings = 0;
    let totalCompletedTasks = 0;
    const tasks = [];

    earnings.forEach(record => {
      totalEarnings += record.totalEarning;

      record.approvedPages.forEach(page => {
        totalCompletedTasks++;

        tasks.push({
          _id: page.taskId?._id || page.pageId,
          title: page.taskId?.title || `Approved Page`,
          series: page.seriesId?.title || 'Unknown',
          approvedAt: page.approvedAt,
          earnings: record.ratePerPage,
        });
      });
    });

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        totalCompletedTasks,
        nextPayoutDate: null,
        tasks,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// @desc Get income analytics chart
// @route GET /api/assistant/income/analytics
// @access ASSISTANT
exports.getIncomeAnalytics = async (req, res) => {
  try {
    const earnings = await AssistantEarning.find({
      assistantId: req.user._id,
    }).sort({ month: 1 });

    const data = earnings.map(item => ({
      month: item.month,
      amount: item.totalEarning,
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// @desc Get payout account
// @route GET /api/assistant/payout-account
// @access ASSISTANT
exports.getPayoutAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        cardholder: user.name,
        bankName: user.bankName || 'Not Updated',
        cardNumberLast4:
  user.accountNumber
    ? user.accountNumber.slice(-4)
    : '----',
        status: 'Active',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};