const File = require("../models/File");
const path = require("path");

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const newFile = await File.create({
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileUrl: req.file.path,

      uploadedBy: req.user?._id,
      roleUploaded: req.user?.role,

      chapterId: req.body.chapterId || null,
    });

    if (req.io) {
      req.io.emit("file_uploaded", {
        fileName: newFile.originalName,
        uploadedBy: req.user?.name,
      });
    }

    res.status(201).json({
      success: true,
      data: newFile,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getFile = async (req, res) => {
  try {

    const file = await File.findById(req.params.id)
      .populate("uploadedBy", "name email role")
      .populate("chapterId");

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    res.status(200).json({
      success: true,
      data: file,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.downloadFile = async (req, res) => {
  try {

    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    res.download(path.resolve(file.fileUrl));

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllFiles = async (req, res) => {
  try {

    const files = await File.find()
      .populate("uploadedBy", "name email role")
      .populate("chapterId");

    res.status(200).json({
      success: true,
      count: files.length,
      data: files,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};