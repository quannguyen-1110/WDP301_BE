const Volume = require("../models/Volume.js");
const Chapter = require("../models/Chapter.js");
const Series = require("../models/Series.js");
const { logAction } = require("../utils/auditLogger");

const canManageVolume = async (user, seriesId) => {
  if (user.role === "ADMIN") return true;
  if (user.role === "MANGAKA") {
    return Boolean(await Series.exists({ _id: seriesId, mangakaId: user._id }));
  }
  return false;
};

// @desc    Get all volumes (optionally filtered by seriesId)
// @route   GET /api/volumes
exports.getAllVolumes = async (req, res) => {
  try {
    const { seriesId } = req.query;
    const filter = {};
    if (seriesId) filter.seriesId = seriesId;

    if (req.user.role === "MANGAKA" || req.user.role === "EDITOR") {
      const seriesFilter = req.user.role === "MANGAKA"
        ? { mangakaId: req.user._id }
        : { editorId: req.user._id };
      const allowedSeriesIds = await Series.find(seriesFilter).distinct("_id");
      if (seriesId && !allowedSeriesIds.some((id) => id.toString() === seriesId)) {
        return res.status(200).json({ success: true, count: 0, data: [] });
      }
      if (!seriesId) filter.seriesId = { $in: allowedSeriesIds };
    }

    const volumes = await Volume.find(filter)
      .populate("seriesId", "title")
      .sort({ volumeNumber: 1 });

    // Attach chapter count per volume
    const data = await Promise.all(
      volumes.map(async (volume) => {
        const totalChapters = await Chapter.countDocuments({ volumeId: volume._id });
        return {
          ...volume.toObject(),
          totalChapters,
        };
      })
    );

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new volume
// @route   POST /api/volumes
exports.createVolume = async (req, res) => {
  try {
    const { seriesId, volumeNumber, title, dueAt } = req.body;

    if (!seriesId || !Number.isInteger(Number(volumeNumber)) || Number(volumeNumber) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Series and a positive volume number are required",
      });
    }

    if (!(await canManageVolume(req.user, seriesId))) {
      return res.status(403).json({
        success: false,
        message: "You can only create volumes for a series you manage",
      });
    }

    if (await Volume.exists({ seriesId, volumeNumber: Number(volumeNumber) })) {
      return res.status(409).json({
        success: false,
        message: `Volume ${volumeNumber} already exists in this series`,
      });
    }

    let parsedDueAt = null;
    if (dueAt) {
      parsedDueAt = new Date(dueAt);
      if (Number.isNaN(parsedDueAt.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid volume deadline" });
      }
    }

    const volume = await Volume.create({
      seriesId,
      volumeNumber: Number(volumeNumber),
      title: title?.trim(),
      dueAt: parsedDueAt,
      createdBy: req.user._id,
      status: "IN_PROGRESS",
    });

    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Created Volume",
      `Volume ${volumeNumber} - ${title || "Untitled"}`,
      `Series ID: ${seriesId}`
    );

    if (req.io) {
      req.io.emit("volume_created", volume);
    }

    res.status(201).json({ success: true, message: "Volume created successfully", data: volume });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "This volume number already exists in the series" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get volume by ID
// @route   GET /api/volumes/:id
exports.getVolumeById = async (req, res) => {
  try {
    const volume = await Volume.findById(req.params.id).populate("seriesId", "title");
    if (!volume) {
      return res.status(404).json({ success: false, message: "Volume not found" });
    }

    const chapters = await Chapter.find({ volumeId: volume._id })
      .populate("seriesId", "title")
      .sort({ chapterNumber: 1 });

    res.status(200).json({
      success: true,
      data: {
        ...volume.toObject(),
        chapters,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a volume
// @route   PUT /api/volumes/:id
exports.updateVolume = async (req, res) => {
  try {
    const volume = await Volume.findById(req.params.id).select("seriesId status");
    if (!volume) {
      return res.status(404).json({ success: false, message: "Volume not found" });
    }
    if (!(await canManageVolume(req.user, volume.seriesId))) {
      return res.status(403).json({
        success: false,
        message: "You can only update volumes for a series you manage",
      });
    }

    const requestedUpdates = { ...req.body };
    if (requestedUpdates.deadline !== undefined && requestedUpdates.dueAt === undefined) {
      requestedUpdates.dueAt = requestedUpdates.deadline;
    }

    const allowedUpdates = ["volumeNumber", "title", "status", "dueAt", "totalChapters"];
    const updatePayload = Object.fromEntries(
      Object.entries(requestedUpdates).filter(([key]) => allowedUpdates.includes(key))
    );

    if (updatePayload.volumeNumber !== undefined) {
      const volumeNumber = Number(updatePayload.volumeNumber);
      if (!Number.isInteger(volumeNumber) || volumeNumber <= 0) {
        return res.status(400).json({ success: false, message: "Invalid volume number" });
      }
      const duplicate = await Volume.exists({
        _id: { $ne: req.params.id },
        seriesId: volume.seriesId,
        volumeNumber,
      });
      if (duplicate) {
        return res.status(409).json({ success: false, message: `Volume ${volumeNumber} already exists in this series` });
      }
      updatePayload.volumeNumber = volumeNumber;
    }

    const updated = await Volume.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    });

    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Updated Volume",
      `Volume ID: ${req.params.id}`,
      `New status: ${updated?.status}`
    );

    if (req.io) {
      req.io.emit("volume_updated", updated);
    }

    res.status(200).json({ success: true, message: "Volume updated successfully", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a volume (and optionally its chapters)
// @route   DELETE /api/volumes/:id
exports.deleteVolume = async (req, res) => {
  try {
    const volume = await Volume.findById(req.params.id).select("seriesId");
    if (!volume) {
      return res.status(404).json({ success: false, message: "Volume not found" });
    }
    if (!(await canManageVolume(req.user, volume.seriesId))) {
      return res.status(403).json({
        success: false,
        message: "You can only delete volumes for a series you manage",
      });
    }

    const { deleteChapters } = req.body;
    if (deleteChapters) {
      await Chapter.deleteMany({ volumeId: volume._id });
    } else {
      // Chỉ bỏ liên kết volume, giữ chapters
      await Chapter.updateMany({ volumeId: volume._id }, { $set: { volumeId: null } });
    }

    await Volume.findByIdAndDelete(req.params.id);

    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Deleted Volume",
      `Volume ID: ${req.params.id}`,
      `Series ID: ${volume.seriesId}`
    );

    if (req.io) {
      req.io.emit("volume_deleted", { id: req.params.id });
    }

    res.status(200).json({ success: true, message: "Volume deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
