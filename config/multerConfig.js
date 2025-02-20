// multerConfig.js
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Ensure the /uploads directory exists
const uploadDir = path.join(__dirname, '..', 'public/uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// File type validation function
// File type validation function
const fileFilter = (req, file, cb) => {
  // Check if the file and its mimetype are defined
  if (!file || !file.mimetype) {
    return cb(new Error('File is not provided or has no mimetype.'));
  }

  const allowedTypes = /jpeg|jpg|png|avif|webp|svg/;
  const isValidType = allowedTypes.test(file.mimetype.toLowerCase());

  if (isValidType) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error('Only image files (jpg, jpeg, png, avif, webp, svg) are allowed.')); // Reject the file with an error
  }
};


// Multer configuration
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
  fileFilter: fileFilter
});



module.exports = upload;