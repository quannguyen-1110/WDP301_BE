const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { swaggerUi, specs } = require('./config/swagger.js');

const authRoutes = require('./routes/auth.js');
const seriesRoutes = require('./routes/series.js');
const taskRoutes = require('./routes/task.js');
const chapterRoutes = require('./routes/chapter.js');
const ratingRoutes = require('./routes/rating.js');
const rankRoutes = require('./routes/rank.js');
const voteRoutes = require('./routes/vote.js');
const submissionRoutes = require('./routes/submission.js');

const { protect, authorize } = require('./middleware/auth.js');

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ===== SWAGGER API DOCS =====
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// inject io
const setupApp = (io) => {
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/series', protect, seriesRoutes);
  app.use('/api/tasks', protect, taskRoutes);
  app.use('/api/chapters', protect, chapterRoutes);
  app.use('/api/ratings', protect, ratingRoutes);
  app.use('/api/ranks', protect, rankRoutes);
  app.use('/api/votes', protect, authorize('BOARD_MEMBER'), voteRoutes);
  app.use('/api/submissions', protect, submissionRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'Mangaka API is running',
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  });

  return app;
};

module.exports = setupApp;