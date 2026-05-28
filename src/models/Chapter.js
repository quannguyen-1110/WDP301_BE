const mongoose = require('mongoose');

const CHAPTER_STATUS = ['IN_PROGRESS', 'COMPLETED'];

const chapterSchema = new mongoose.Schema(
  {
    seriesId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Series',
      required: true,
    },
    chapterNumber: Number,
    status: {
      type: String,
      enum: CHAPTER_STATUS,
      default: CHAPTER_STATUS[0],
    },
    dueAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model('Chapter', chapterSchema);