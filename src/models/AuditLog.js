const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  userName: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true, // Ví dụ: "Created Proposal", "Approved Task", "Submitted Vote"
  },
  target: {
    type: String,
    required: true, // Ví dụ: "Series Proposal #123", "Task #456"
  },
  details: {
    type: String,
    default: '',
  },
  ip: String,
  userAgent: String,
}, {
  timestamps: true,
});

module.exports = mongoose.model('AuditLog', auditLogSchema);