const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const slugify = require('slugify');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/helpers');

const router = express.Router();

// Ensure upload directories exist
const uploadDirs = [
  'uploads',
  'uploads/images',
  'uploads/posters',
  'uploads/gallery',
  'uploads/news',
  'uploads/team',
  'uploads/partners',
  'uploads/temp',
  'uploads/thumbnails',
  'uploads/thumbnails/images',
  'uploads/thumbnails/posters',
  'uploads/thumbnails/gallery',
  'uploads/thumbnails/news',
  'uploads/thumbnails/team',
  'uploads/thumbnails/partners'
];
uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads', 'temp'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only image files and PDFs are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 15 * 1024 * 1024 // 15MB for original images
  }
});

/**
 * @route   POST /api/v1/upload/image
 * @desc    Upload image - saves original + creates compressed thumbnail
 * @access  Private
 */
router.post('/image',
  protect,
  authorize('admin', 'editor'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { category = 'images', thumbnailWidth = 800, thumbnailQuality = 80 } = req.body;

    // Validate category
    const validCategories = ['images', 'posters', 'gallery', 'news', 'team', 'partners'];
    const finalCategory = validCategories.includes(category) ? category : 'images';

    let baseFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    if (req.body.seoName) {
      const seoSlug = slugify(req.body.seoName, { lower: true, strict: true });
      if (seoSlug) {
        baseFilename = `${seoSlug}-${Math.round(Math.random() * 1E5)}`;
      }
    }

    // Get original file extension
    const originalExt = path.extname(req.file.originalname).toLowerCase();
    const isWebP = originalExt === '.webp';

    // Save original file (preserve original format)
    const originalFilename = `${baseFilename}${originalExt}`;
    const originalPath = path.join(__dirname, '..', 'uploads', finalCategory, originalFilename);

    // Copy original file to destination
    fs.copyFileSync(req.file.path, originalPath);

    // Create thumbnail (compressed webp for fast loading)
    const thumbnailFilename = `${baseFilename}.webp`;
    const thumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', finalCategory, thumbnailFilename);

    // Process thumbnail with sharp
    await sharp(req.file.path)
      .resize(parseInt(thumbnailWidth), null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: parseInt(thumbnailQuality) })
      .toFile(thumbnailPath);

    // Delete temp file
    fs.unlinkSync(req.file.path);

    // Generate URLs
    const originalUrl = `/uploads/${finalCategory}/${originalFilename}`;
    const thumbnailUrl = `/uploads/thumbnails/${finalCategory}/${thumbnailFilename}`;

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: originalUrl,           // Full quality original
        thumbnailUrl: thumbnailUrl, // Compressed for fast loading
        filename: originalFilename,
        category: finalCategory
      }
    });
  })
);

/**
 * @route   POST /api/v1/upload/images
 * @desc    Upload multiple images
 * @access  Private
 */
router.post('/images',
  protect,
  authorize('admin', 'editor'),
  upload.array('images', 10),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const { category = 'gallery', quality = 85 } = req.body;
    const validCategories = ['images', 'posters', 'gallery', 'news', 'producers', 'partners'];
    const finalCategory = validCategories.includes(category) ? category : 'gallery';

    const uploadedFiles = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      let baseFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      if (req.body.seoName) {
        const seoSlug = slugify(req.body.seoName, { lower: true, strict: true });
        if (seoSlug) {
          baseFilename = `${seoSlug}-${i + 1}-${Math.round(Math.random() * 1E4)}`;
        }
      }

      const filename = `${baseFilename}.webp`;
      const outputPath = path.join(__dirname, '..', 'uploads', finalCategory, filename);

      await sharp(file.path)
        .webp({ quality: parseInt(quality) })
        .toFile(outputPath);

      // Delete temp file
      fs.unlinkSync(file.path);

      uploadedFiles.push({
        url: `/uploads/${finalCategory}/${filename}`,
        filename,
        originalName: file.originalname
      });
    }

    res.json({
      success: true,
      message: `${uploadedFiles.length} images uploaded successfully`,
      data: uploadedFiles
    });
  })
);

/**
 * @route   POST /api/v1/upload/poster
 * @desc    Upload and process a movie poster
 * @access  Private
 */
router.post('/poster',
  protect,
  authorize('admin', 'editor'),
  upload.single('poster'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    let baseFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    if (req.body.seoName) {
      const seoSlug = slugify(req.body.seoName, { lower: true, strict: true });
      if (seoSlug) {
        baseFilename = `${seoSlug}-poster`;
      }
    }

    // Create different sizes
    const sizes = {
      full: { width: 1200, height: 1800 },
      medium: { width: 600, height: 900 },
      thumbnail: { width: 300, height: 450 }
    };

    const results = {};

    for (const [size, dimensions] of Object.entries(sizes)) {
      const filename = `${baseFilename}-${size}.webp`;
      const outputPath = path.join(__dirname, '..', 'uploads', 'posters', filename);

      await sharp(req.file.path)
        .resize(dimensions.width, dimensions.height, { fit: 'cover' })
        .webp({ quality: size === 'thumbnail' ? 70 : 85 })
        .toFile(outputPath);

      results[size] = `/uploads/posters/${filename}`;
    }

    // Delete temp file
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: 'Poster uploaded and processed successfully',
      data: {
        posterUrl: results.full,
        mediumUrl: results.medium,
        thumbnailUrl: results.thumbnail
      }
    });
  })
);

/**
 * @route   POST /api/v1/upload/document
 * @desc    Upload a document (PDF)
 * @access  Private
 */
router.post('/document',
  protect,
  authorize('admin', 'editor'),
  upload.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (req.file.mimetype !== 'application/pdf') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Only PDF files are allowed'
      });
    }

    // Create documents directory if not exists
    const docsDir = path.join(__dirname, '..', 'uploads', 'documents');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    const filename = `${Date.now()}-${req.file.originalname}`;
    const newPath = path.join(docsDir, filename);

    fs.renameSync(req.file.path, newPath);

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        url: `/uploads/documents/${filename}`,
        filename,
        originalName: req.file.originalname
      }
    });
  })
);

// Video file filter for trailer uploads
const videoFileFilter = (req, file, cb) => {
  // Accept video files
  const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only video files (MP4, WebM, OGG, MOV) are allowed'), false);
  }
};

const videoUpload = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_VIDEO_SIZE) || 1536 * 1024 * 1024 // 1.5GB for videos
  }
});

// Ensure videos directory exists
const videoDir = path.join(__dirname, '..', 'uploads', 'videos');
if (!fs.existsSync(videoDir)) {
  fs.mkdirSync(videoDir, { recursive: true });
}

/**
 * @route   POST /api/v1/upload/video
 * @desc    Upload a video file (for trailers, promos, etc.)
 * @access  Private
 */
router.post('/video',
  protect,
  authorize('admin', 'editor'),
  videoUpload.single('video'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video file uploaded'
      });
    }

    const baseFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const originalExt = path.extname(req.file.originalname).toLowerCase();
    const videoFilename = `${baseFilename}${originalExt}`;
    const videoPath = path.join(__dirname, '..', 'uploads', 'videos', videoFilename);

    // Move video from temp to videos directory
    fs.renameSync(req.file.path, videoPath);

    const videoUrl = `/uploads/videos/${videoFilename}`;

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      data: {
        url: videoUrl,
        filename: videoFilename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  })
);

/**
 * @route   DELETE /api/v1/upload
 * @desc    Delete an uploaded file
 * @access  Private
 */
router.delete('/',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { url } = req.body;

    if (!url || !url.startsWith('/uploads/')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file URL'
      });
    }

    const filePath = path.join(__dirname, '..', url);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
  })
);

/**
 * @route   PUT /api/v1/upload/rename
 * @desc    Rename a file and update database mappings (Admin only)
 * @access  Private (Admin only)
 */
router.put('/rename',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { category, filename, newName } = req.body;

    if (!category || !filename || !newName) {
      return res.status(400).json({
        success: false,
        message: 'Category, filename, and newName are required'
      });
    }

    const validCategories = ['images', 'posters', 'gallery', 'news', 'producers', 'partners', 'videos', 'resumes', 'team'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // Prepare paths
    const sanitizedFilename = path.basename(filename);
    const oldFilePath = path.join(__dirname, '..', 'uploads', category, sanitizedFilename);
    const oldUrl = `/uploads/${category}/${sanitizedFilename}`;

    if (!fs.existsSync(oldFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'Original file not found'
      });
    }

    // Generate new filename
    const originalExt = path.extname(sanitizedFilename).toLowerCase();
    const seoSlug = slugify(newName, { lower: true, strict: true });
    if (!seoSlug) {
      return res.status(400).json({
        success: false,
        message: 'Invalid new name'
      });
    }

    const newFilename = `${seoSlug}-${Math.round(Math.random() * 1E5)}${originalExt}`;
    const newFilePath = path.join(__dirname, '..', 'uploads', category, newFilename);
    const newUrl = `/uploads/${category}/${newFilename}`;

    // Rename main file
    fs.renameSync(oldFilePath, newFilePath);

    // Track URLs for DB update
    const urlReplacements = [
      { oldUrl, newUrl }
    ];

    // Handle thumbnail rename
    let oldThumbnailUrl = '';
    let newThumbnailUrl = '';
    const oldThumbnailFilename = sanitizedFilename.replace(/\.[^.]+$/, '.webp');
    const oldThumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', category, oldThumbnailFilename);

    if (fs.existsSync(oldThumbnailPath)) {
      const newThumbnailFilename = newFilename.replace(/\.[^.]+$/, '.webp');
      const newThumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', category, newThumbnailFilename);
      fs.renameSync(oldThumbnailPath, newThumbnailPath);

      oldThumbnailUrl = `/uploads/thumbnails/${category}/${oldThumbnailFilename}`;
      newThumbnailUrl = `/uploads/thumbnails/${category}/${newThumbnailFilename}`;
      urlReplacements.push({ oldUrl: oldThumbnailUrl, newUrl: newThumbnailUrl });
    }

    // ----- Database Auto-Mapping -----
    // We will dynamically search through all relevant models to replace the old URL
    const mongoose = require('mongoose');

    // Mongoose Models
    const Movie = mongoose.model('Movie');
    const TeamMember = mongoose.model('TeamMember');
    const CompanyInfo = mongoose.model('CompanyInfo');
    const News = mongoose.models.News; // May not be loaded, use optional chaining if needed
    const Career = mongoose.models.Career;

    let updatedCount = 0;

    // Helper to recursively replace string values in nested objects/arrays
    const deepReplaceUrl = (obj, replacements) => {
      let modified = false;
      if (!obj || typeof obj !== 'object') return modified;

      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          for (const rep of replacements) {
            // Check if string exactly equals the URL or contains it (for rich text)
            if (value === rep.oldUrl) {
              obj[key] = rep.newUrl;
              modified = true;
            } else if (value.includes(rep.oldUrl)) {
              // Be careful with short strings, but URLs are usually distinct
              obj[key] = value.split(rep.oldUrl).join(rep.newUrl);
              modified = true;
            }
          }
        } else if (typeof value === 'object') {
          const childModified = deepReplaceUrl(value, replacements);
          if (childModified) modified = true;
        }
      }
      return modified;
    };

    // Update function for a specific model collection
    const updateCollection = async (Model) => {
      if (!Model) return;
      const docs = await Model.find({});
      for (const doc of docs) {
        // Use lean-like raw object to prevent Mongoose magic during mutation
        const rawObj = doc.toObject();

        // Remove Mongo immutable fields temporarily
        const { _id, createdAt, updatedAt, ...mutableData } = rawObj;

        if (deepReplaceUrl(mutableData, urlReplacements)) {
          await Model.updateOne({ _id: doc._id }, { $set: mutableData });
          updatedCount++;
        }
      }
    };

    try {
      if (Movie) await updateCollection(Movie);
      if (TeamMember) await updateCollection(TeamMember);
      if (CompanyInfo) await updateCollection(CompanyInfo);
      if (News) await updateCollection(News);
      if (Career) await updateCollection(Career);
    } catch (dbError) {
      console.error('Auto-mapping DB Error:', dbError);
      // We don't fail the request because the file rename succeeded
    }

    res.json({
      success: true,
      message: `File renamed successfully and updated in ${updatedCount} DB entries.`,
      data: {
        oldUrl,
        newUrl,
        newFilename
      }
    });
  })
);

/**
 * @route   GET /api/v1/upload/list/:category
 * @desc    List uploaded files in a category
 * @access  Private
 */
router.get('/list/:category',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const { category } = req.params;
    const validCategories = ['images', 'posters', 'gallery', 'news', 'producers', 'partners', 'documents', 'team'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    const dirPath = path.join(__dirname, '..', 'uploads', category);

    if (!fs.existsSync(dirPath)) {
      return res.json({
        success: true,
        data: []
      });
    }

    const files = fs.readdirSync(dirPath)
      .filter(file => !file.startsWith('.'))
      .map(filename => ({
        filename,
        url: `/uploads/${category}/${filename}`,
        size: fs.statSync(path.join(dirPath, filename)).size,
        created: fs.statSync(path.join(dirPath, filename)).birthtime
      }))
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({
      success: true,
      count: files.length,
      data: files
    });
  })
);

/**
 * @route   GET /api/v1/upload/media/all
 * @desc    List ALL uploaded files across all categories (Admin only)
 * @access  Private (Admin only)
 */
router.get('/media/all',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const categories = ['images', 'posters', 'gallery', 'news', 'producers', 'partners', 'videos', 'resumes', 'team'];
    const allFiles = [];
    let totalSize = 0;

    for (const category of categories) {
      const dirPath = path.join(__dirname, '..', 'uploads', category);

      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath)
          .filter(file => !file.startsWith('.'))
          .map(filename => {
            const filePath = path.join(dirPath, filename);
            const stats = fs.statSync(filePath);
            totalSize += stats.size;

            return {
              id: `${category}-${filename}`,
              filename,
              category,
              url: `/uploads/${category}/${filename}`,
              thumbnailUrl: `/uploads/thumbnails/${category}/${filename.replace(/\.[^.]+$/, '.webp')}`,
              size: stats.size,
              sizeFormatted: formatFileSize(stats.size),
              created: stats.birthtime,
              modified: stats.mtime,
              extension: path.extname(filename).toLowerCase().slice(1)
            };
          });

        allFiles.push(...files);
      }
    }

    // Sort by created date (newest first)
    allFiles.sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({
      success: true,
      count: allFiles.length,
      totalSize: formatFileSize(totalSize),
      totalSizeBytes: totalSize,
      data: allFiles
    });
  })
);

/**
 * @route   GET /api/v1/upload/media/stats
 * @desc    Get storage statistics (Admin only)
 * @access  Private (Admin only)
 */
router.get('/media/stats',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const categories = ['images', 'posters', 'gallery', 'news', 'producers', 'partners', 'videos', 'resumes', 'thumbnails', 'team'];
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      categories: {}
    };

    for (const category of categories) {
      const dirPath = path.join(__dirname, '..', 'uploads', category);
      let categorySize = 0;
      let categoryCount = 0;

      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter(file => !file.startsWith('.'));
        categoryCount = files.length;

        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const fileStats = fs.statSync(filePath);
          if (fileStats.isFile()) {
            categorySize += fileStats.size;
          } else if (fileStats.isDirectory()) {
            // Handle nested directories (like thumbnails/images, thumbnails/news, etc.)
            const nestedFiles = fs.readdirSync(filePath).filter(f => !f.startsWith('.'));
            for (const nestedFile of nestedFiles) {
              const nestedPath = path.join(filePath, nestedFile);
              const nestedStats = fs.statSync(nestedPath);
              if (nestedStats.isFile()) {
                categorySize += nestedStats.size;
                categoryCount++;
              }
            }
          }
        }

        stats.totalFiles += categoryCount;
        stats.totalSize += categorySize;
        stats.categories[category] = {
          count: categoryCount,
          size: categorySize,
          sizeFormatted: formatFileSize(categorySize)
        };
      }
    }

    stats.totalSizeFormatted = formatFileSize(stats.totalSize);

    res.json({
      success: true,
      data: stats
    });
  })
);

/**
 * @route   DELETE /api/v1/upload/media/:category/:filename
 * @desc    Delete a specific file (Admin only)
 * @access  Private (Admin only)
 */
router.delete('/media/:category/:filename',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { category, filename } = req.params;
    const validCategories = ['images', 'posters', 'gallery', 'news', 'producers', 'partners', 'videos', 'resumes', 'team'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(__dirname, '..', 'uploads', category, sanitizedFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Delete the main file
    fs.unlinkSync(filePath);

    // Try to delete the thumbnail if it exists
    const thumbnailFilename = sanitizedFilename.replace(/\.[^.]+$/, '.webp');
    const thumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', category, thumbnailFilename);
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  })
);

/**
 * @route   DELETE /api/v1/upload/media/bulk
 * @desc    Delete multiple files (Admin only)
 * @access  Private (Admin only)
 */
router.delete('/media/bulk',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { files } = req.body; // Array of { category, filename }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files specified for deletion'
      });
    }

    const validCategories = ['images', 'posters', 'gallery', 'news', 'producers', 'partners', 'videos', 'resumes', 'team'];
    const results = {
      deleted: [],
      failed: []
    };

    for (const file of files) {
      const { category, filename } = file;

      if (!validCategories.includes(category)) {
        results.failed.push({ category, filename, reason: 'Invalid category' });
        continue;
      }

      const sanitizedFilename = path.basename(filename);
      const filePath = path.join(__dirname, '..', 'uploads', category, sanitizedFilename);

      if (!fs.existsSync(filePath)) {
        results.failed.push({ category, filename, reason: 'File not found' });
        continue;
      }

      try {
        fs.unlinkSync(filePath);

        // Try to delete thumbnail
        const thumbnailFilename = sanitizedFilename.replace(/\.[^.]+$/, '.webp');
        const thumbnailPath = path.join(__dirname, '..', 'uploads', 'thumbnails', category, thumbnailFilename);
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
        }

        results.deleted.push({ category, filename });
      } catch (err) {
        results.failed.push({ category, filename, reason: err.message });
      }
    }

    res.json({
      success: true,
      message: `Deleted ${results.deleted.length} files, ${results.failed.length} failed`,
      data: results
    });
  })
);

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;
