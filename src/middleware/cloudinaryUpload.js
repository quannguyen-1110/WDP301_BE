const { cloudinary } = require("../config/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: "mangaka_uploads",
      resource_type: "auto",
      public_id: `${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, "")}`,
    };
  },
});

const upload = multer({ storage });

module.exports = upload;