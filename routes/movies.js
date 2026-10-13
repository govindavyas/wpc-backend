const express = require('express');
const { body, query } = require('express-validator');
const Movie = require('../models/Movie');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { validate, asyncHandler } = require('../middleware/helpers');

const router = express.Router();

/**
 * @route   GET /api/v1/movies
 * @desc    Get all movies with filtering and pagination
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    year,
    genre,
    featured,
    highlight,
    showOnHomepage,
    sort = '-year',
    search
  } = req.query;

  // Build query
  const queryObj = { isActive: true };

  if (status) queryObj.status = status;
  if (year) queryObj.year = year;
  if (genre) queryObj.genres = { $in: [genre] };
  if (featured === 'true') queryObj.featured = true;
  if (highlight === 'true') queryObj.highlight = true;
  if (showOnHomepage === 'true') queryObj.showOnHomepage = true;
  if (search) {
    queryObj.$or = [
      { title: { $regex: search, $options: 'i' } },
      { originalTitle: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [movies, total] = await Promise.all([
    Movie.find(queryObj)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Movie.countDocuments(queryObj)
  ]);

  res.json({
    success: true,
    count: movies.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: movies
  });
}));

/**
 * @route   GET /api/v1/movies/featured
 * @desc    Get featured/highlighted movie for hero section
 * @access  Public
 */
router.get('/featured', asyncHandler(async (req, res) => {
  const movie = await Movie.findOne({ isActive: true, highlight: true }) ||
                await Movie.findOne({ isActive: true }).sort({ year: -1 });

  res.json({
    success: true,
    data: movie
  });
}));

/**
 * @route   GET /api/v1/movies/homepage
 * @desc    Get movies for homepage display
 * @access  Public
 */
router.get('/homepage', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 6;

  const movies = await Movie.find({ isActive: true, showOnHomepage: true })
    .sort({ order: 1, year: -1 })
    .limit(limit);

  res.json({
    success: true,
    count: movies.length,
    data: movies
  });
}));

/**
 * @route   GET /api/v1/movies/admin
 * @desc    Get all movies for admin (includes inactive)
 * @access  Private/Admin
 */
router.get('/admin', protect, authorize('admin', 'editor'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;

  const queryObj = {};
  if (search) {
    queryObj.$or = [
      { title: { $regex: search, $options: 'i' } },
      { originalTitle: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [movies, total] = await Promise.all([
    Movie.find(queryObj)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Movie.countDocuments(queryObj)
  ]);

  res.json({
    success: true,
    count: movies.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: movies
  });
}));

/**
 * @route   GET /api/v1/movies/:id
 * @desc    Get single movie by ID or slug
 * @access  Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Try to find by ID first, then by slug
  let movie = await Movie.findById(id).catch(() => null);
  if (!movie) {
    movie = await Movie.findOne({ slug: id, isActive: true });
  }

  if (!movie) {
    return res.status(404).json({
      success: false,
      message: 'Movie not found'
    });
  }

  res.json({
    success: true,
    data: movie
  });
}));

/**
 * @route   POST /api/v1/movies
 * @desc    Create a new movie
 * @access  Private/Admin
 */
router.post('/',
  protect,
  authorize('admin', 'editor'),
  [
    body('title').trim().notEmpty().withMessage('Movie title is required'),
    body('year').notEmpty().withMessage('Release year is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    // Convert year to string if it's a number (model expects string)
    if (typeof req.body.year === 'number') {
      req.body.year = String(req.body.year);
    }
    const movie = await Movie.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Movie created successfully',
      data: movie
    });
  })
);

/**
 * @route   PUT /api/v1/movies/:id
 * @desc    Update a movie
 * @access  Private/Admin
 */
router.put('/:id',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    let movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    // Convert year to string if it's a number (model expects string)
    if (typeof req.body.year === 'number') {
      req.body.year = String(req.body.year);
    }

    try {
      movie = await Movie.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
      });

      res.json({
        success: true,
        message: 'Movie updated successfully',
        data: movie
      });
    } catch (err) {
      console.error('Movie update error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to update movie'
      });
    }
  })
);

/**
 * @route   DELETE /api/v1/movies/:id
 * @desc    Delete a movie (soft delete)
 * @access  Private/Admin
 */
router.delete('/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    // Soft delete
    movie.isActive = false;
    await movie.save();

    res.json({
      success: true,
      message: 'Movie deleted successfully'
    });
  })
);

/**
 * @route   DELETE /api/v1/movies/:id/permanent
 * @desc    Permanently delete a movie
 * @access  Private/Admin
 */
router.delete('/:id/permanent',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const movie = await Movie.findByIdAndDelete(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    res.json({
      success: true,
      message: 'Movie permanently deleted'
    });
  })
);

/**
 * @route   PUT /api/v1/movies/:id/toggle
 * @desc    Toggle movie active status
 * @access  Private/Admin
 */
router.put('/:id/toggle',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    movie.isActive = !movie.isActive;
    await movie.save();

    res.json({
      success: true,
      message: `Movie ${movie.isActive ? 'activated' : 'deactivated'} successfully`,
      data: movie
    });
  })
);

/**
 * @route   PUT /api/v1/movies/:id/highlight
 * @desc    Set movie as highlighted (removes highlight from others)
 * @access  Private/Admin
 */
router.put('/:id/highlight',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    // Remove highlight from all movies
    await Movie.updateMany({}, { highlight: false });

    // Set highlight on selected movie
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      { highlight: true },
      { new: true }
    );

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    res.json({
      success: true,
      message: 'Movie set as highlighted',
      data: movie
    });
  })
);

/**
 * @route   POST /api/v1/movies/:id/gallery
 * @desc    Add image to movie gallery
 * @access  Private/Admin
 */
router.post('/:id/gallery',
  protect,
  authorize('admin', 'editor'),
  [
    body('url').trim().notEmpty().withMessage('Image URL is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    movie.gallery.push(req.body);
    await movie.save();

    res.status(201).json({
      success: true,
      message: 'Gallery image added successfully',
      data: movie.gallery
    });
  })
);

/**
 * @route   DELETE /api/v1/movies/:id/gallery/:galleryId
 * @desc    Remove image from movie gallery
 * @access  Private/Admin
 */
router.delete('/:id/gallery/:galleryId',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    movie.gallery = movie.gallery.filter(
      item => item._id.toString() !== req.params.galleryId
    );
    await movie.save();

    res.json({
      success: true,
      message: 'Gallery image removed successfully',
      data: movie.gallery
    });
  })
);

/**
 * @route   POST /api/v1/movies/:id/cast
 * @desc    Add cast member to movie
 * @access  Private/Admin
 */
router.post('/:id/cast',
  protect,
  authorize('admin', 'editor'),
  [
    body('name').trim().notEmpty().withMessage('Cast name is required'),
    body('type').isIn(['leadCast', 'supportingCast', 'specialAppearances']).withMessage('Invalid cast type'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const { type, ...castData } = req.body;
    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    if (!movie.credits[type]) {
      movie.credits[type] = [];
    }

    movie.credits[type].push(castData);
    await movie.save();

    res.status(201).json({
      success: true,
      message: 'Cast member added successfully',
      data: movie.credits
    });
  })
);

module.exports = router;
