const Feedback = require("../models/Feedback.js");
const Chapter = require("../models/Chapter.js");
const Series = require("../models/Series.js");
const User = require("../models/User.js");
const Assignment = require("../models/Assignment.js");
const Task = require("../models/Task.js");
const Notification = require("../models/Notification.js");
const { logAction } = require("../utils/auditLogger");

// Editor đang quản lý series này?
const isEditorOfSeries = async (user, seriesId) => {
  if (user.role === "ADMIN") return true;
  if (user.role === "EDITOR") {
    return Boolean(await Series.exists({ _id: seriesId, editorId: user._id }));
  }
  return false;
};

// @desc    Editor gửi feedback cho chapter (gửi được nhiều lần)
// @route   POST /api/feedback
exports.createFeedback = async (req, res) => {
  try {
    const { chapterId, message } = req.body;
    if (!chapterId || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chapter and feedback message are required",
      });
    }

    const chapter = await Chapter.findById(chapterId).select("seriesId chapterNumber title");
    if (!chapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    if (!(await isEditorOfSeries(req.user, chapter.seriesId))) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned editor can send feedback for this chapter",
      });
    }

    // Tăng version feedback cho chapter này
    const lastFeedback = await Feedback.findOne({ chapterId }).sort({ version: -1 });
    const version = (lastFeedback?.version || 0) + 1;

    const feedback = await Feedback.create({
      chapterId,
      seriesId: chapter.seriesId,
      editorId: req.user._id,
      message: message.trim(),
      status: "OPEN",
      version,
    });

    await feedback.populate("editorId", "name email");

    // Cập nhật trạng thái chapter
    await Chapter.findByIdAndUpdate(chapterId, { status: "REVISION_REQUESTED" });

    // Thông báo cho mangaka của series
    const series = await Series.findById(chapter.seriesId).select("mangakaId title");
    if (series?.mangakaId) {
      const notification = await Notification.create({
        userId: series.mangakaId,
        title: "New Feedback from Editor",
        content: `Editor sent feedback (v${version}) on Chapter ${chapter.chapterNumber} of "${series.title}". Please review and assign an assistant.`,
        type: "WARNING",
        targetType: "CHAPTER",
        targetId: chapterId,
        link: `/mangaka/chapter/${chapterId}`,
      });
      if (req.io) {
        req.io.to(series.mangakaId.toString()).emit("notification", notification);
        req.io.emit("notification", notification);
      }
    }

    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Sent Chapter Feedback",
      `Chapter ${chapter.chapterNumber}`,
      `Feedback v${version}: ${message.trim().substring(0, 100)}`
    );

    res.status(201).json({
      success: true,
      message: "Feedback sent successfully",
      data: feedback,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Lấy toàn bộ feedback của một chapter (lịch sử)
// @route   GET /api/feedback/chapter/:chapterId
exports.getChapterFeedback = async (req, res) => {
  try {
    const chapter = await Chapter.findById(req.params.chapterId).select("seriesId");
    if (!chapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    // Kiểm tra quyền truy cập
    if (req.user.role === "MANGAKA") {
      const owns = await Series.exists({ _id: chapter.seriesId, mangakaId: req.user._id });
      if (!owns) return res.status(403).json({ success: false, message: "You do not have access to this chapter" });
    } else if (req.user.role === "EDITOR") {
      const manages = await Series.exists({ _id: chapter.seriesId, editorId: req.user._id });
      if (!manages) return res.status(403).json({ success: false, message: "You do not have access to this chapter" });
} else if (req.user.role === "ASSISTANT") {
      const assigned = await Assignment.exists({ chapterId: chapter._id, assistantId: req.user._id });
      const taskAssigned = await Task.exists({ chapterId: chapter._id, assignedTo: req.user._id });
      if (!assigned && !taskAssigned) return res.status(403).json({ success: false, message: "You do not have access to this chapter" });
    }

    const feedbacks = await Feedback.find({ chapterId: chapter._id })
      .populate("editorId", "name email")
      .populate("assignmentId", "title status assistantId")
      .sort({ version: 1 });

    res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cập nhật feedback (status, message)
// @route   PUT /api/feedback/:id
exports.updateFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: "Feedback not found" });
    }

    const { status, message } = req.body;

    // Chỉ editor đã tạo feedback hoặc mangaka quản lý chapter mới được cập nhật trạng thái
    const chapter = await Chapter.findById(feedback.chapterId).select("seriesId");
    const isEditorOwner = req.user.role === "EDITOR" && feedback.editorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "ADMIN";
    const isMangaka = req.user.role === "MANGAKA" &&
      Boolean(await Series.exists({ _id: chapter?.seriesId, mangakaId: req.user._id }));

    if (!isEditorOwner && !isAdmin && !isMangaka) {
      return res.status(403).json({ success: false, message: "You do not have permission to update this feedback" });
    }

    if (status && !["OPEN", "IN_PROGRESS", "RESOLVED", "APPROVED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid feedback status" });
    }

    if (message !== undefined) feedback.message = message;
    if (status) feedback.status = status;

    // Khi editor approve feedback => chapter chuyển sang APPROVED
    if (status === "APPROVED") {
      await Chapter.findByIdAndUpdate(feedback.chapterId, { status: "APPROVED" });
    }

    await feedback.save();

    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Updated Feedback",
      `Feedback ID: ${req.params.id}`,
      `Status: ${feedback.status}`
    );

    res.status(200).json({
      success: true,
      message: "Feedback updated successfully",
      data: feedback,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mangaka giao task cho assistant để xử lý feedback
// @route   PUT /api/chapters/:id/feedback/assign
exports.assignFeedback = async (req, res) => {
  try {
    const chapterId = req.params.id;
    const { assistantId, title, description } = req.body;

    if (!assistantId) {
      return res.status(400).json({ success: false, message: "Assistant is required" });
    }

    const chapter = await Chapter.findById(chapterId).select("seriesId chapterNumber title");
    if (!chapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    // Chỉ mangaka của series mới được giao task
    if (req.user.role === "MANGAKA") {
      const owns = await Series.exists({ _id: chapter.seriesId, mangakaId: req.user._id });
      if (!owns) {
        return res.status(403).json({ success: false, message: "You can only assign tasks for your own series" });
      }
    }

    // Tìm feedback OPEN mới nhất của chapter
    const feedback = await Feedback.findOne({ chapterId, status: "OPEN" }).sort({ version: -1 });
    if (!feedback) {
      return res.status(400).json({ success: false, message: "No open feedback to assign" });
    }

    // Kiểm tra assistant hợp lệ
    const assistant = await User.findById(assistantId);
    if (!assistant || assistant.role !== "ASSISTANT" || assistant.isActive === false || assistant.deletedAt) {
      return res.status(400).json({ success: false, message: "Assigned user must be an active ASSISTANT" });
    }

    // Tạo assignment
    const assignment = await Assignment.create({
      seriesId: chapter.seriesId,
      chapterId,
      assistantId,
      assignedBy: req.user._id,
      feedbackId: feedback._id,
      title: title?.trim() || `Handle feedback v${feedback.version}`,
      description: description || feedback.message,
      status: "ASSIGNED",
    });

    // Cập nhật feedback
    feedback.status = "IN_PROGRESS";
    feedback.assignmentId = assignment._id;
    await feedback.save();

    // Thông báo assistant
    const notification = await Notification.create({
      userId: assistantId,
      title: "New Chapter Assignment",
      content: `You have been assigned to Chapter ${chapter.chapterNumber} to handle feedback v${feedback.version}.`,
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

    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Assigned Feedback to Assistant",
      `Chapter ${chapter.chapterNumber}`,
      `Feedback v${feedback.version}, Assistant: ${assistantId}`
    );

    res.status(201).json({
      success: true,
      message: "Feedback assigned to assistant",
      data: { assignment, feedback },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Editor approve feedback (đóng feedback, chapter -> APPROVED)
// @route   PUT /api/chapters/:id/feedback/approve
exports.approveFeedback = async (req, res) => {
  try {
    const chapterId = req.params.id;
    const { approved, note } = req.body;

    const chapter = await Chapter.findById(chapterId).select("seriesId chapterNumber");
    if (!chapter) {
      return res.status(404).json({ success: false, message: "Chapter not found" });
    }

    // Chỉ editor của series mới approve
    if (req.user.role === "EDITOR") {
      const manages = await Series.exists({ _id: chapter.seriesId, editorId: req.user._id });
      if (!manages) {
        return res.status(403).json({ success: false, message: "Only the assigned editor can approve this chapter" });
      }
    }

    // Tìm feedback mới nhất
    const feedback = await Feedback.findOne({ chapterId }).sort({ version: -1 });
    if (!feedback) {
      return res.status(404).json({ success: false, message: "No feedback found for this chapter" });
    }

    if (approved === false) {
      // Editor chưa đồng ý => mở lại feedback để mangaka sửa tiếp
      feedback.status = "OPEN";
      feedback.message = note || feedback.message;
      await feedback.save();
      await Chapter.findByIdAndUpdate(chapterId, { status: "REVISION_REQUESTED" });

      return res.status(200).json({
        success: true,
        message: "Feedback reopened for further revision",
        data: feedback,
      });
    }

    // Editor đồng ý => đóng feedback, chapter APPROVED
    feedback.status = "APPROVED";
    await feedback.save();
    await Chapter.findByIdAndUpdate(chapterId, { status: "APPROVED" });

    // Thông báo mangaka
    const series = await Series.findById(chapter.seriesId).select("mangakaId title");
    if (series?.mangakaId) {
      const notification = await Notification.create({
        userId: series.mangakaId,
        title: "Chapter Approved by Editor",
        content: `Editor approved Chapter ${chapter.chapterNumber} of "${series.title}".`,
        type: "INFO",
        targetType: "CHAPTER",
        targetId: chapterId,
      });
      if (req.io) {
        req.io.to(series.mangakaId.toString()).emit("notification", notification);
        req.io.emit("notification", notification);
      }
    }

    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Approved Chapter Feedback",
      `Chapter ${chapter.chapterNumber}`,
      `Feedback v${feedback.version}`
    );

    res.status(200).json({
      success: true,
      message: "Chapter approved",
      data: feedback,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Xóa feedback
// @route   DELETE /api/feedback/:id
exports.deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: "Feedback not found" });
    }

    const isEditorOwner = req.user.role === "EDITOR" && feedback.editorId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "ADMIN";
    if (!isEditorOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Only the editor who created it or admin can delete this feedback" });
    }

    await feedback.deleteOne();

    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Deleted Feedback",
      `Feedback ID: ${req.params.id}`,
      `Chapter ID: ${feedback.chapterId}`
    );

    res.status(200).json({ success: true, message: "Feedback deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
