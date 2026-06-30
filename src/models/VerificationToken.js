const mongoose = require('mongoose');

const verificationTokenSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // 10 minutes (600 seconds)
  },
});

module.exports = mongoose.model('VerificationToken', verificationTokenSchema);
