const express = require('express');
const {
  getCatalogue,
  getSeries,
  getChapter,
} = require('../controllers/readerController');

const router = express.Router();

router.get('/series', getCatalogue);
router.get('/series/:id', getSeries);
router.get('/chapters/:id', getChapter);

module.exports = router;

