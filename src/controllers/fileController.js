exports.uploadFile = async (req, res) => {
  res.json({
    message: "upload ok",
  });
};

exports.getFile = async (req, res) => {
  res.json({
    message: "view ok",
  });
};

exports.downloadFile = async (req, res) => {
  res.json({
    message: "download ok",
  });
};