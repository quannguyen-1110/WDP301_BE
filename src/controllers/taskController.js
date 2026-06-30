const Task = require('../models/Task.js');
const Page = require('../models/Page.js');
const User = require('../models/User.js');
const AssistantEarning = require('../models/AssistantEarning.js');

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
      region,
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
      region: region || null,
    });

    // Update assigned pages
    if (pageIds && pageIds.length > 0) {
      await Page.updateMany(
        { _id: { $in: pageIds } },
        { status: 'HAS_TASK' }
      );
    }

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
        message:
          "Action must be 'APPROVE', 'REJECT', or 'REVISION_REQUESTED'",
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
      task.reviewNote =
        reviewNote || 'Approved by author';

      await task.save();

      await Page.updateMany(
        {
          _id: { $in: task.pageIds },
        },
        {
          status: 'APPROVED',
          reviewNote:
            reviewNote || 'Approved by author',
          approvedAt: new Date(),
        }
      );

      // Assistant earning
      const pagesCount = task.pageIds.length;

      if (pagesCount > 0) {
        const now = new Date();

        const monthStr = `${now.getFullYear()}-${String(
          now.getMonth() + 1
        ).padStart(2, '0')}`;

        let earning =
          await AssistantEarning.findOne({
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

        const existingApprovedPageIds =
          earning.approvedPages.map((ap) =>
            ap.pageId.toString()
          );

        let addedPagesCount = 0;

        for (const pageId of task.pageIds) {
          if (
            !existingApprovedPageIds.includes(
              pageId.toString()
            )
          ) {
            earning.approvedPages.push({
              pageId,
              chapterId: task.chapterId,
              seriesId: task.seriesId,
              approvedAt: new Date(),
            });

            addedPagesCount++;
          }
        }

        earning.totalPagesApproved +=
          addedPagesCount;

        earning.totalEarning =
          earning.totalPagesApproved *
          earning.ratePerPage;

        await earning.save();
      }

      if (req.io) {
        req.io.emit('task_approved', task);
      }
    } else {
      task.status = 'REVISION_REQUESTED';
      task.reviewedAt = new Date();
      task.reviewNote =
        reviewNote ||
        'Revision requested by author';

      await task.save();

      await Page.updateMany(
        {
          _id: { $in: task.pageIds },
          status: { $ne: 'APPROVED' },
        },
        {
          status: 'REVISION_REQUESTED',
          reviewNote:
            reviewNote ||
            'Revision requested by author',
        }
      );

      if (req.io) {
        req.io.emit(
          'task_revision_requested',
          task
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Task has been ${
        action === 'APPROVE'
          ? 'approved'
          : 'returned for revision'
      } successfully`,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};