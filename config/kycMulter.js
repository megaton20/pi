const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure the /uploads directory exists
const uploadDir = path.join(__dirname, '..', 'public/kyc');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Folder to store uploaded files
    },
    filename: function (req, file, cb) {
        // Use timestamp + original filename for uniqueness and readability
        const uniqueSuffix = `${Date.now()}_${file.originalname}`;
        cb(null, uniqueSuffix);
    }
});

// File filter to check the file type (restrict to images/pdf)
const fileFilter = (req, file, cb) => {
    const allowedFileTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedFileTypes.test(file.mimetype.toLowerCase());

    if (extname && mimetype) {
        cb(null, true); // Accept the file
    } else {
        cb(new Error('Error: Only images (jpeg, jpg, png) or PDFs are allowed.'));
    }
};

// Init upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: fileFilter
}).fields([
    { name: 'cacDocument', maxCount: 1 },
    { name: 'ninDocument', maxCount: 1 },
    { name: 'passportDocument', maxCount: 1 },
    { name: 'voterDocument', maxCount: 1 }
]);

module.exports = upload;