const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// ── Cloudinary storage configs ─────────────────────────────
const pdfStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'docket-factory/scripts',
    allowed_formats: ['pdf'],
    resource_type: 'raw',
  },
});

const audioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'docket-factory/audio',
    allowed_formats: ['mp3', 'wav', 'ogg', 'm4a', 'webm'],
    resource_type: 'video',
  },
});

// ── MIME type filters ──────────────────────────────────────
const pdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const audioFilter = (req, file, cb) => {
  const allowed = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
                   'audio/x-m4a', 'audio/webm', 'video/webm'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files (MP3, WAV, OGG, M4A, WebM) are allowed'), false);
  }
};

// ── Multer instances with size limits ─────────────────────
// PDF: max 10 MB
const uploadPDF = multer({
  storage: pdfStorage,
  fileFilter: pdfFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Audio: max 50 MB
const uploadAudio = multer({
  storage: audioStorage,
  fileFilter: audioFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Multer error handler middleware ────────────────────────
// Attach this after any upload route to return clean JSON errors
// instead of Express's default HTML error page.
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'File too large. Max size: PDF 10 MB, Audio 50 MB.' });
    }
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

module.exports = { uploadPDF, uploadAudio, handleUploadError };
