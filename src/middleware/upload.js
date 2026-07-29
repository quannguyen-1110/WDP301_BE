const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/");
  },

  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() + path.extname(file.originalname)
    );
  },
});

const allowedExtensions = new Set([
  ".zip",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".psd",
  ".clip",
]);

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 20, parts: 25 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    return cb(null, true);
  },
});

module.exports = upload;