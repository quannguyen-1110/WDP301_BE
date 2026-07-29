const AuditLog = require('../models/AuditLog');

const logAction = async (userId, userName, action, target, details = '') => {
  try {
    await AuditLog.create({
      userId,
      userName,
      action,
      target,
      details,
    });
  } catch (err) {
    console.error('Audit Log Error:', err.message);
  }
};

module.exports = { logAction };