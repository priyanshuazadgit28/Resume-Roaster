const multer = require('multer');
const ApiError = require('../utils/apiError');

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_BYTES,
  },
  fileFilter,
});

const uploadSingle = upload.single('file');

const uploadPDF = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(400, 'PDF exceeds 5 megabyte limit'));
      }
      return next(new ApiError(400, err.message));
    } else if (err) {
      return next(err);
    }
    
    if (!req.file) {
      return next(new ApiError(400, 'Please upload a PDF file'));
    }
    
    next();
  });
};

module.exports = { uploadPDF };
