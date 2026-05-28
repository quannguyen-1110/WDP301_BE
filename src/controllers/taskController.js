const Task = require('../models/Task.js');

exports.createTask = async (req, res) => {
  try {
    const task = await Task.create(req.body);
    req.io.emit('task_assigned', task); // realtime
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
      { status: 'DONE' },
      { new: true }
    );

    req.io.emit('task_done', task); // realtime
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
    const tasks = await Task.find({ assignedTo: req.query.userId });
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