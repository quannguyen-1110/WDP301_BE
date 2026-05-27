import Task from "../models/task.model.js";

export const createTask = async (req, res) => {
  const task = await Task.create(req.body);
  req.io.emit("task_assigned", task); // realtime
  res.json(task);
};

export const submitTask = async (req, res) => {
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { status: "DONE" },
    { new: true }
  );

  req.io.emit("task_done", task); // realtime
  res.json(task);
};

export const getMyTasks = async (req, res) => {
  const tasks = await Task.find({ assignedTo: req.query.userId });
  res.json(tasks);
};