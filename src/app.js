const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { swaggerUi, specs } = require('./config/swagger.js');
const path = require('path');

const authRoutes = require('./routes/auth.js');
const seriesRoutes = require('./routes/series.js');
const taskRoutes = require('./routes/task.js');
const chapterRoutes = require('./routes/chapter.js');
const volumeRoutes = require('./routes/volume.js');
const feedbackRoutes = require('./routes/feedback.js');
const assignmentRoutes = require('./routes/assignment.js');
const ratingRoutes = require('./routes/rating.js');
const rankRoutes = require('./routes/rank.js');
const voteRoutes = require('./routes/vote.js');
const submissionRoutes = require('./routes/submission.js');
const assistantRoutes = require('./routes/assistant.js');
const annotationRoutes = require('./routes/annotation.js');
const editorRoutes = require('./routes/editor.js');
const rankingsRoutes = require('./routes/rankings.js');
const auditLogRoutes = require('./routes/auditLog.js');

// FILE ROUTES
const fileRoutes = require('./routes/file.js');
const userRoutes = require('./routes/users.js');
const proposalRoutes = require('./routes/proposal.js');
const notificationRoutes = require('./routes/notification.js');
const directiveRoutes = require('./routes/directive.js');
const defenseReportRoutes = require('./routes/defenseReport.js');
const boardRoutes = require('./routes/board.js');
const readerRoutes = require('./routes/reader.js');

const { protect } = require('./middleware/auth.js');

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'src/uploads'))
);
// Catalogue imports live in the FE public folder. Serving them through the API
// host keeps the same MongoDB imageUrl working on Chrome and Android emulator.
const mangaAssetRoot = process.env.MANGA_ASSET_ROOT
  || path.resolve(__dirname, '../../wdp301-fe/public/manga');
app.use('/manga', express.static(mangaAssetRoot));
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
  app.use('/api/volumes', protect, volumeRoutes);
  app.use('/api/feedback', protect, feedbackRoutes);
  app.use('/api/assignments', protect, assignmentRoutes);
  app.use('/api/reader', protect, readerRoutes);
  app.use('/api/ratings', protect, ratingRoutes);
  app.use('/api/ranks', protect, rankRoutes);
  app.use('/api/votes', protect, voteRoutes);
  app.use('/api/submissions', protect, submissionRoutes);
  app.use('/api/assistant', protect, assistantRoutes);
  app.use('/api/annotations', protect, annotationRoutes);
  app.use('/api/editor', protect, editorRoutes);
  app.use('/api/defense-reports', protect, defenseReportRoutes);
  app.use('/api/rankings', rankingsRoutes);
  app.use('/api/notifications', protect, notificationRoutes);
  app.use('/api/audit-logs', protect, auditLogRoutes);

  app.use('/api/directives', protect, directiveRoutes);
  app.use('/api/board', boardRoutes);
  // FILE MANAGEMENT
  app.use('/api/files', protect, fileRoutes);

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
    if (err.name === 'MulterError') {
      return res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE'
          ? 'File exceeds the 50MB limit'
          : 'Unsupported or invalid upload',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  });

  return app;
};

module.exports = setupApp;
