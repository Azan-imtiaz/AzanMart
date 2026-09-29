const multer = require("multer");

// SVG is left out on purpose: it can carry scripts, and we serve images from our own origin
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new Error("Images must be JPEG, PNG, WebP or GIF"));
  },
});

module.exports = upload;
