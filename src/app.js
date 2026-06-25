const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { swaggerUi, specs } = require('./config/swagger.js');
const path = require('path');

const authRoutes = require('./routes/auth.js');
const seriesRoutes = require('./routes/series.js');
const taskRoutes = require('./routes/task.js');
const chapterRoutes = require('./routes/chapter.js');
const ratingRoutes = require('./routes/rating.js');
const rankRoutes = require('./routes/rank.js');
const voteRoutes = require('./routes/vote.js');
const submissionRoutes = require('./routes/submission.js');
const assistantRoutes = require('./routes/assistant.js');
const annotationRoutes = require('./routes/annotation.js');
const editorRoutes = require('./routes/editor.js');
const rankingsRoutes = require('./routes/rankings.js');

// FILE ROUTES
const fileRoutes = require('./routes/file.js');
const userRoutes = require('./routes/users.js');
const proposalRoutes = require('./routes/proposal.js');
const notificationRoutes = require('./routes/notification.js');
const defenseReportRoutes = require('./routes/defenseReport.js');

const { protect, authorize } = require('./middleware/auth.js');

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'src/uploads'))
);
// ===== SWAGGER API DOCS =====
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// inject io
const setupApp = (io) => {
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  // ===== ROUTES =====
  app.use('/api/auth', authRoutes);
  app.use('/api/users', protect, userRoutes);
  app.use('/api/series/proposal', protect, proposalRoutes);
  app.use('/api/series', protect, seriesRoutes);
  app.use('/api/tasks', protect, taskRoutes);
  app.use('/api/chapters', protect, chapterRoutes);
  app.use('/api/ratings', protect, ratingRoutes);
  app.use('/api/ranks', protect, rankRoutes);
  app.use('/api/votes', protect, authorize('BOARD_MEMBER'), voteRoutes);
  app.use('/api/submissions', protect, submissionRoutes);
  app.use('/api/assistant', protect, authorize('ASSISTANT'), assistantRoutes);
  app.use('/api/annotations', protect, annotationRoutes);
  app.use('/api/editor', protect, authorize('EDITOR'), editorRoutes);
  app.use('/api/defense-reports', protect, defenseReportRoutes);
  app.use('/api/rankings', rankingsRoutes);
  app.use('/api/notifications', protect, notificationRoutes);

  // FILE MANAGEMENT
  app.use('/api/files', fileRoutes);

  // ===== HEALTH CHECK =====
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'Mangaka API is running',
      timestamp: new Date().toISOString(),
    });
  });

  // ===== 404 =====
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // ===== ERROR HANDLER =====
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