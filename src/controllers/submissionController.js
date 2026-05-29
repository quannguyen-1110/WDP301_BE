const Submission = require('../models/SeriesSubmission.js');
const Vote = require('../models/Vote.js');

exports.createSubmission = async (req, res) => {
  try {
    const submission = await Submission.create(req.body);
    req.io.emit('submission_submitted', submission);
    res.status(201).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find();
    res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateSubmission = async (req, res) => {
  try {
    const submission = await Submission.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteSubmission = async (req, res) => {
  try {
    const submission = await Submission.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id);
    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getSubmissionsBySeriesId = async (req, res) => {
  try {
    const submissions = await Submission.find({ seriesId: req.params.seriesId });
    res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getVotesBySubmissionId = async (req, res) => {
  try {
    const votes = await Vote.find({ submissionId: req.params.submissionId });
    res.status(200).json({
      success: true,
      data: votes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
