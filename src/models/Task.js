const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  seriesId: String,
  chapterId: String,
  assignedTo: String, // userId
  title: String,
  status: {
    type: String,
    enum: ['PENDING', 'DONE'],
    default: 'PENDING'
  }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);