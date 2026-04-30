import multer from 'multer';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024
  },
  fileFilter: (_request, file, callback) => {
    const allowed = new Set(['application/json', 'text/json']);
    if (allowed.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error('Only JSON uploads are allowed'));
  },
});
