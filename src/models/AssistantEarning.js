const mongoose = require('mongoose');

const assistantEarningSchema = new mongoose.Schema({
  assistantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  month: {
    type: String, // "YYYY-MM"
    required: true,
  },
  totalPagesApproved: {
    type: Number,
    default: 0,
  },
  ratePerPage: {
    type: Number,
    default: 50000, // VND/page
  },
  totalEarning: {
    type: Number,
    default: 0,
  },
  approvedPages: [{
    pageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
    },
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
    },
    approvedAt: Date,
  }],
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID'],
    default: 'PENDING',
  },
  paidAt: Date,
}, { timestamps: true });

// Đảm bảo mỗi assistant chỉ có 1 bản ghi thu nhập cho mỗi tháng
assistantEarningSchema.index({ assistantId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('AssistantEarning', assistantEarningSchema);
