const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');
const { swaggerUi, specs } = require('./src/config/swagger');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ===== SWAGGER API DOCS =====
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ===== ROUTES =====
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/series', require('./src/routes/series'));

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

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Mangaka API Server`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`========================================`);
  console.log(`\nEndpoints:`);
  console.log(`  POST   /api/auth/register`);
  console.log(`  POST   /api/auth/login`);
  console.log(`  GET    /api/auth/me`);
  console.log(`  POST   /api/series`);
  console.log(`  GET    /api/series`);
  console.log(`  GET    /api/series/:id`);
  console.log(`  PUT    /api/series/:id/review`);
  console.log(`  PUT    /api/series/:id/status`);
  console.log(`  GET    /api/health`);
  console.log(`========================================\n`);
});
