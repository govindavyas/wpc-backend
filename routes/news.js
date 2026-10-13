const express = require('express');
const { body, query } = require('express-validator');
const News = require('../models/News');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { validate, asyncHandler } = require('../middleware/helpers');

const router = express.Router();

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map(tag => String(tag).trim()).filter(Boolean))];
  }

  if (typeof tags === 'string') {
    return [...new Set(tags.split(',').map(tag => tag.trim()).filter(Boolean))];
  }

  return [];
}

/**
 * @route   GET /api/v1/news
 * @desc    Get all news with filtering and pagination
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    tag,
    featured,
    sort = '-date',
    search
  } = req.query;

  // Build query
  const queryObj = { isActive: true };

  if (category) queryObj.category = category;
  if (tag) queryObj.tags = { $in: [tag] };
  if (featured === 'true') queryObj.featured = true;
  if (search) {
    queryObj.$or = [
      { title: { $regex: search, $options: 'i' } },
      { summary: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [news, total] = await Promise.all([
    News.find(queryObj)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedMovie', 'title slug posterUrl'),
    News.countDocuments(queryObj)
  ]);

  res.json({
    success: true,
    count: news.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: news
  });
}));

/**
 * @route   GET /api/v1/news/dashboard
 * @desc    Get news for homepage dashboard
 * @access  Public
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 4;

  const news = await News.getDashboardNews(limit);

  res.json({
    success: true,
    count: news.length,
    data: news
  });
}));

/**
 * @route   GET /api/v1/news/categories
 * @desc    Get all news categories with counts
 * @access  Public
 */
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await News.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  res.json({
    success: true,
    data: categories.map(cat => ({
      name: cat._id,
      count: cat.count
    }))
  });
}));

/**
 * @route   GET /api/v1/news/tags
 * @desc    Get all unique tags
 * @access  Public
 */
router.get('/tags', asyncHandler(async (req, res) => {
  const tags = await News.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);

  res.json({
    success: true,
    data: tags.map(tag => ({
      name: tag._id,
      count: tag.count
    }))
  });
}));

/**
 * @route   GET /api/v1/news/admin
 * @desc    Get all news for admin (includes inactive)
 * @access  Private/Admin
 */
router.get('/admin', protect, authorize('admin', 'editor'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, category } = req.query;

  const queryObj = {};
  if (search) {
    queryObj.$or = [
      { title: { $regex: search, $options: 'i' } },
      { summary: { $regex: search, $options: 'i' } }
    ];
  }
  if (category) queryObj.category = category;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [news, total] = await Promise.all([
    News.find(queryObj)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('relatedMovie', 'title slug'),
    News.countDocuments(queryObj)
  ]);

  res.json({
    success: true,
    count: news.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: news
  });
}));

/**
 * @route   GET /api/v1/news/:id
 * @desc    Get single news by ID or slug
 * @access  Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Try to find by ID first, then by slug
  let newsItem = await News.findById(id).populate('relatedMovie', 'title slug posterUrl').catch(() => null);
  if (!newsItem) {
    newsItem = await News.findOne({ slug: id, isActive: true }).populate('relatedMovie', 'title slug posterUrl');
  }

  if (!newsItem) {
    return res.status(404).json({
      success: false,
      message: 'News article not found'
    });
  }

  // Increment view count
  newsItem.views += 1;
  await newsItem.save({ validateBeforeSave: false });

  res.json({
    success: true,
    data: newsItem
  });
}));

/**
 * @route   POST /api/v1/news
 * @desc    Create a new news article
 * @access  Private/Admin
 */
router.post('/',
  protect,
  authorize('admin', 'editor'),
  [
    body('title').trim().notEmpty().withMessage('News title is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('summary').trim().notEmpty().withMessage('Summary is required'),
    body('fullText').trim().notEmpty().withMessage('Full text content is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const createData = {
      ...req.body,
      tags: normalizeTags(req.body.tags)
    };

    const newsItem = await News.create(createData);

    res.status(201).json({
      success: true,
      message: 'News article created successfully',
      data: newsItem
    });
  })
);

/**
 * @route   PUT /api/v1/news/:id
 * @desc    Update a news article
 * @access  Private/Admin
 */
router.put('/:id',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    let newsItem = await News.findById(req.params.id);

    if (!newsItem) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    const updateData = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(updateData, 'tags')) {
      updateData.tags = normalizeTags(updateData.tags);
    }

    newsItem = await News.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      message: 'News article updated successfully',
      data: newsItem
    });
  })
);

/**
 * @route   DELETE /api/v1/news/:id
 * @desc    Delete a news article
 * @access  Private/Admin
 */
router.delete('/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const newsItem = await News.findByIdAndDelete(req.params.id);

    if (!newsItem) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    res.json({
      success: true,
      message: 'News article deleted successfully'
    });
  })
);

/**
 * @route   DELETE /api/v1/news/:id/permanent
 * @desc    Permanently delete a news article
 * @access  Private/Admin
 */
router.delete('/:id/permanent',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const newsItem = await News.findByIdAndDelete(req.params.id);

    if (!newsItem) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    res.json({
      success: true,
      message: 'News article permanently deleted'
    });
  })
);

/**
 * @route   PUT /api/v1/news/:id/toggle
 * @desc    Toggle news active status
 * @access  Private/Admin
 */
router.put('/:id/toggle',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const newsItem = await News.findById(req.params.id);

    if (!newsItem) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    newsItem.isActive = !newsItem.isActive;
    await newsItem.save();

    res.json({
      success: true,
      message: `News article ${newsItem.isActive ? 'activated' : 'deactivated'} successfully`,
      data: newsItem
    });
  })
);

/**
 * @route   PUT /api/v1/news/:id/dashboard
 * @desc    Toggle news dashboard visibility
 * @access  Private/Admin
 */
router.put('/:id/dashboard',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const newsItem = await News.findById(req.params.id);

    if (!newsItem) {
      return res.status(404).json({
        success: false,
        message: 'News article not found'
      });
    }

    newsItem.showOnDashboard = !newsItem.showOnDashboard;
    await newsItem.save();

    res.json({
      success: true,
      message: `News ${newsItem.showOnDashboard ? 'will show' : 'hidden from'} dashboard`,
      data: newsItem
    });
  })
);

module.exports = router;
