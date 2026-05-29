const Vote = require('../models/Vote.js');

exports.submitVote = async (req, res) => {
  try {
    const vote = await Vote.create(req.body);
    req.io.emit('vote_submitted', vote);
    res.status(201).json({
      success: true,
      data: vote,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateVote = async (req, res) => {
  try {
    const votes = await Vote.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
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

exports.deleteVote = async (req, res) => {
  try {
    const votes = await Vote.findByIdAndDelete(req.params.id);
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

exports.getMyVotes = async (req, res) => {
  try {
    const votes = await Vote.find({ userId: req.query.userId });
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