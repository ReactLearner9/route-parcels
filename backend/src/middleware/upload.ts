import multer from 'multer';

function createUpload(fileSize: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize
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
}

export const upload = createUpload(5 * 1024 * 1024);
export const megaUpload = createUpload(25 * 1024 * 1024);
