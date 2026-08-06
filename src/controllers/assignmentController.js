const Assignment = require("../models/Assignment.js");
const Chapter = require("../models/Chapter.js");
const Series = require("../models/Series.js");
const Feedback = require("../models/Feedback.js");
const User = require("../models/User.js");
const Notification = require("../models/Notification.js");
const { logAction } = require("../utils/auditLogger");

// @desc    Mangaka giao task/mời assistant cho chapter
// @route   POST /api/assignments
exports.createAssignment = async (req, res) => {
  try {
    const { seriesId, chapterId, assistantId, feedbackId, title, description } = req.body;

    if (!seriesId || !chapterId || !assistantId) {
      return res.status(400).json({
        success: false,
        message: "Series, chapter, and assistant are required",
      });
    }

    // Kiểm tra mangaka sở hữu series
    if (req.user.role === "MANGAKA") {
      const owns = await Series.exists({ _id: seriesId, mangakaId: req.user._id });
      if (!owns) {
        return res.status(403).json({ success: false, message: "You can only assign tasks for your own series" });
      }
    }

    const chapter = await Chapter.findOne({ _id: chapterId, seriesId });
    if (!chapter) {
      return res.status(400).json({ success: false, message: "Chapter does not belong to the selected series" });
    }

    // Kiểm tra assistant hợp lệ
    const assistant = await User.findById(assistantId);
    if (!assistant || assistant.role !== "ASSISTANT" || assistant.isActive === false || assistant.deletedAt) {
      return res.status(400).json({ success: false, message: "Assigned user must be an active ASSISTANT" });
    }

    // Nếu có feedbackId, kiểm tra feedback thuộc chapter này và đang OPEN
    let feedback = null;
    if (feedbackId) {
      feedback = await Feedback.findOne({ _id: feedbackId, chapterId });
      if (!feedback) {
        return res.status(400).json({ success: false, message: "Feedback does not belong to this chapter" });
      }
    }

    const assignment = await Assignment.create({
      seriesId,
      chapterId,
      assistantId,
      assignedBy: req.user._id,
      feedbackId: feedbackId || null,
      title: title?.trim() || (feedback ? `Handle feedback v${feedback.version}` : "Chapter assignment"),
      description: feedback?.message || description,
      status: "ASSIGNED",
    });

    // Cập nhật trạng thái feedback sang IN_PROGRESS
    if (feedback) {
      feedback.status = "IN_PROGRESS";
      feedback.assignmentId = assignment._id;
      await feedback.save();
    }

    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Assigned Chapter to Assistant",
      `Chapter: ${chapter.chapterNumber}`,
      `Assistant: ${assistantId}`
    );

    // Thông báo cho assistant
    const notification = await Notification.create({
      userId: assistantId,
      title: "New Chapter Assignment",
      content: `You have been assigned to Chapter ${chapter.chapterNumber}${feedback ? ` to handle feedback v${feedback.version}` : ""}.`,
      type: "INFO",
      targetType: "CHAPTER",
      targetId: chapterId,
      link: `/assistant/chapter/${chapterId}`,
    });

    if (req.io) {
      req.io.to(assistantId.toString()).emit("notification", notification);
      req.io.emit("assignment_created", assignment);
      req.io.emit("notification", notification);
    }

    const populated = await Assignment.findById(assignment._id)
      .populate("assistantId", "name email")
      .populate("chapterId", "chapterNumber title")
      .populate("seriesId", "title")
      .populate("feedbackId");

    res.status(201).json({ success: true, message: "Assignment created successfully", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Lấy danh sách assignment (theo vai trò)
// @route   GET /api/assignments
exports.getAssignments = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "ASSISTANT") {
      filter.assistantId = req.user._id;
    } else if (req.user.role === "MANGAKA") {
      filter.assignedBy = req.user._id;
    } else if (req.user.role === "EDITOR") {
      const seriesIds = await Series.find({ editorId: req.user._id }).distinct("_id");
      filter.seriesId = { $in: seriesIds };
    }

    if (req.query.seriesId) filter.seriesId = req.query.seriesId;
    if (req.query.chapterId) filter.chapterId = req.query.chapterId;

    const assignments = await Assignment.find(filter)
      .populate("assistantId", "name email")
      .populate("assignedBy", "name email")
      .populate("chapterId", "chapterNumber title")
      .populate("seriesId", "title")
      .populate("feedbackId")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Lấy assignment của assistant hiện tại
// @route   GET /api/assignments/my
exports.getMyAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({ assistantId: req.user._id })
      .populate("assistantId", "name email")
      .populate("assignedBy", "name email")
      .populate("chapterId", "chapterNumber title")
      .populate("seriesId", "title")
      .populate("feedbackId")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: assignments.length, data: assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cập nhật trạng thái assignment
// @route   PUT /api/assignments/:id/status
exports.updateAssignmentStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid assignment status" });
    }

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    // Assistant chỉ cập nhật assignment của mình
    const isAssistant = req.user.role === "ASSISTANT" && assignment.assistantId.toString() === req.user._id.toString();
    const isMangaka = req.user.role === "MANGAKA" && assignment.assignedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "ADMIN";
    if (!isAssistant && !isMangaka && !isAdmin) {
      return res.status(403).json({ success: false, message: "You do not have permission to update this assignment" });
    }

    assignment.status = status;
    if (status === "SUBMITTED") assignment.submittedAt = new Date();
    if (status === "COMPLETED") assignment.completedAt = new Date();
    await assignment.save();

    // Khi assistant submit => feedback chuyển RESOLVED (mangaka sẽ review)
    if (assignment.feedbackId && status === "SUBMITTED") {
      const feedback = await Feedback.findById(assignment.feedbackId);
      if (feedback && feedback.status === "IN_PROGRESS") {
        feedback.status = "RESOLVED";
        feedback.revisionHistory.push({
          assignmentId: assignment._id,
          note: note || "Assistant submitted revised version",
        });
        await feedback.save();

        // Thông báo cho assistant rằng cần review
        const chapter = await Chapter.findById(assignment.chapterId).select("chapterNumber");
        const notification = await Notification.create({
          userId: assignment.assignedBy,
          title: "Assistant Submitted Revision",
          content: `Assistant submitted a revised version for Chapter ${chapter?.chapterNumber}. Please review and send back to editor.`,
          type: "INFO",
          targetType: "CHAPTER",
          targetId: assignment.chapterId,
        });
        if (req.io) {
          req.io.to(assignment.assignedBy.toString()).emit("notification", notification);
          req.io.emit("notification", notification);
        }
      }
    }

    // Khi mangaka xác nhận COMPLETED => gửi lại editor review (feedback RESOLVED)
    if (assignment.feedbackId && status === "COMPLETED" && isMangaka) {
      const feedback = await Feedback.findById(assignment.feedbackId);
      if (feedback && feedback.status === "RESOLVED") {
        feedback.status = "OPEN"; // Editor tiếp tục review
        feedback.version = (feedback.version || 0);
        await feedback.save();

        // Thông báo editor
        const series = await Series.findById(assignment.seriesId).select("editorId title");
        if (series?.editorId) {
          const notification = await Notification.create({
            userId: series.editorId,
            title: "Chapter Ready for Review",
            content: `Mangaka has revised Chapter after feedback. Please review and either approve or send more feedback.`,
            type: "INFO",
            targetType: "CHAPTER",
            targetId: assignment.chapterId,
          });
          if (req.io) {
            req.io.to(series.editorId.toString()).emit("notification", notification);
            req.io.emit("notification", notification);
          }
        }
        await Chapter.findByIdAndUpdate(assignment.chapterId, { status: "SUBMITTED" });
      }
    }

    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Updated Assignment Status",
      `Assignment ID: ${req.params.id}`,
      `Status: ${status}`
    );

    const populated = await Assignment.findById(assignment._id)
      .populate("assistantId", "name email")
      .populate("chapterId", "chapterNumber title")
      .populate("seriesId", "title")
      .populate("feedbackId");

    res.status(200).json({ success: true, message: "Assignment status updated", data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
