const multer = require("multer");
const AppError = require("./appError");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/invoices/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype === "application/pdf"
  ) {
    cb(null, true);
  } else {
    cb(
      AppError(
        "Unsupported file type. Please upload only images or PDFs.",
        400,
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

module.exports = upload;
