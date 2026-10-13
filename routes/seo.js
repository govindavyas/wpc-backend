const express = require('express');
const Seo = require('../models/Seo');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/helpers');

const router = express.Router();

/**
 * @route   GET /api/v1/seo
 * @desc    Get all SEO records (admin) or active SEO records (public)
 * @access  Public (limited) / Private (full)
 */
router.get('/', asyncHandler(async (req, res) => {
  const seoRecords = await Seo.find({ isActive: true })
    .select('-__v')
    .sort({ pageName: 1 });

  res.json({
    success: true,
    count: seoRecords.length,
    data: seoRecords
  });
}));

/**
 * @route   GET /api/v1/seo/admin
 * @desc    Get all SEO records for admin (including inactive)
 * @access  Private/Admin
 */
router.get('/admin', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const seoRecords = await Seo.find()
    .select('-__v')
    .sort({ pageName: 1 });

  res.json({
    success: true,
    count: seoRecords.length,
    data: seoRecords
  });
}));

/**
 * @route   GET /api/v1/seo/slug/:slug
 * @desc    Get SEO data by page slug
 * @access  Public
 */
router.get('/slug/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  
  let seo = await Seo.findOne({ 
    pageSlug: slug.toLowerCase(), 
    isActive: true 
  });

  // Fallback to default/home SEO if page not found
  if (!seo) {
    seo = await Seo.findOne({ 
      pageSlug: 'home', 
      isActive: true 
    });
  }

  if (!seo) {
    return res.status(404).json({
      success: false,
      message: 'SEO data not found'
    });
  }

  res.json({
    success: true,
    data: seo
  });
}));

/**
 * @route   GET /api/v1/seo/:id
 * @desc    Get SEO data by ID
 * @access  Private/Admin
 */
router.get('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const seo = await Seo.findById(req.params.id);

  if (!seo) {
    return res.status(404).json({
      success: false,
      message: 'SEO record not found'
    });
  }

  res.json({
    success: true,
    data: seo
  });
}));

/**
 * @route   POST /api/v1/seo
 * @desc    Create new SEO record
 * @access  Private/Admin
 */
router.post('/', protect, authorize('admin'), asyncHandler(async (req, res) => {
  // Validate schema JSON if provided
  if (req.body.schemaJson) {
    const isValidSchema = validateSchemaJson(req.body.schemaJson);
    if (!isValidSchema) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schema JSON. Must include @context and @type properties.'
      });
    }
  }

  // Check if page slug already exists
  const existingSeo = await Seo.findOne({ pageSlug: req.body.pageSlug?.toLowerCase() });
  if (existingSeo) {
    return res.status(400).json({
      success: false,
      message: 'SEO record for this page slug already exists'
    });
  }

  const seo = await Seo.create(req.body);

  res.status(201).json({
    success: true,
    message: 'SEO record created successfully',
    data: seo
  });
}));

/**
 * @route   PUT /api/v1/seo/:id
 * @desc    Update SEO record
 * @access  Private/Admin
 */
router.put('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  // Validate schema JSON if provided
  if (req.body.schemaJson) {
    const isValidSchema = validateSchemaJson(req.body.schemaJson);
    if (!isValidSchema) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schema JSON. Must include @context and @type properties.'
      });
    }
  }

  // Check for duplicate page slug
  if (req.body.pageSlug) {
    const existingSeo = await Seo.findOne({ 
      pageSlug: req.body.pageSlug.toLowerCase(),
      _id: { $ne: req.params.id }
    });
    if (existingSeo) {
      return res.status(400).json({
        success: false,
        message: 'Another SEO record with this page slug already exists'
      });
    }
  }

  const seo = await Seo.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!seo) {
    return res.status(404).json({
      success: false,
      message: 'SEO record not found'
    });
  }

  res.json({
    success: true,
    message: 'SEO record updated successfully',
    data: seo
  });
}));

/**
 * @route   PUT /api/v1/seo/slug/:slug
 * @desc    Update SEO record by page slug
 * @access  Private/Admin
 */
router.put('/slug/:slug', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // Validate schema JSON if provided
  if (req.body.schemaJson) {
    const isValidSchema = validateSchemaJson(req.body.schemaJson);
    if (!isValidSchema) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schema JSON. Must include @context and @type properties.'
      });
    }
  }

  let seo = await Seo.findOne({ pageSlug: slug.toLowerCase() });

  if (!seo) {
    // Create new if doesn't exist
    seo = await Seo.create({
      pageSlug: slug.toLowerCase(),
      pageName: req.body.pageName || slug,
      ...req.body
    });
    
    return res.status(201).json({
      success: true,
      message: 'SEO record created successfully',
      data: seo
    });
  }

  // Update existing
  Object.assign(seo, req.body);
  await seo.save();

  res.json({
    success: true,
    message: 'SEO record updated successfully',
    data: seo
  });
}));

/**
 * @route   DELETE /api/v1/seo/:id
 * @desc    Delete SEO record
 * @access  Private/Admin
 */
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const seo = await Seo.findByIdAndDelete(req.params.id);

  if (!seo) {
    return res.status(404).json({
      success: false,
      message: 'SEO record not found'
    });
  }

  res.json({
    success: true,
    message: 'SEO record deleted successfully'
  });
}));

/**
 * @route   PUT /api/v1/seo/:id/toggle
 * @desc    Toggle SEO record active status
 * @access  Private/Admin
 */
router.put('/:id/toggle', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const seo = await Seo.findById(req.params.id);

  if (!seo) {
    return res.status(404).json({
      success: false,
      message: 'SEO record not found'
    });
  }

  seo.isActive = !seo.isActive;
  await seo.save();

  res.json({
    success: true,
    message: `SEO record ${seo.isActive ? 'activated' : 'deactivated'} successfully`,
    data: seo
  });
}));

/**
 * @route   POST /api/v1/seo/validate-schema
 * @desc    Validate schema JSON
 * @access  Private/Admin
 */
router.post('/validate-schema', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const { schemaJson } = req.body;

  if (!schemaJson) {
    return res.status(400).json({
      success: false,
      message: 'Schema JSON is required'
    });
  }

  const isValid = validateSchemaJson(schemaJson);
  const validation = getSchemaValidationDetails(schemaJson);

  res.json({
    success: true,
    isValid,
    validation
  });
}));

/**
 * @route   GET /api/v1/seo/sitemap/data
 * @desc    Get SEO data for sitemap generation
 * @access  Public
 */
router.get('/sitemap/data', asyncHandler(async (req, res) => {
  const seoRecords = await Seo.find({ isActive: true })
    .select('pageSlug canonicalUrl sitemapPriority sitemapChangeFreq updatedAt')
    .sort({ sitemapPriority: -1 });

  const sitemapData = seoRecords.map(seo => ({
    loc: seo.canonicalUrl,
    lastmod: seo.updatedAt?.toISOString().split('T')[0],
    changefreq: seo.sitemapChangeFreq,
    priority: seo.sitemapPriority
  }));

  res.json({
    success: true,
    data: sitemapData
  });
}));

// Helper function to validate schema JSON
function validateSchemaJson(schema) {
  try {
    let parsed = schema;
    
    // Parse if string
    if (typeof schema === 'string') {
      parsed = JSON.parse(schema);
    }
    
    // Check for required properties
    if (!parsed['@context'] || !parsed['@type']) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

// Helper function to get schema validation details
function getSchemaValidationDetails(schema) {
  const details = {
    isValid: false,
    hasContext: false,
    hasType: false,
    type: null,
    errors: []
  };

  try {
    let parsed = schema;
    
    if (typeof schema === 'string') {
      parsed = JSON.parse(schema);
    }

    details.hasContext = !!parsed['@context'];
    details.hasType = !!parsed['@type'];
    details.type = parsed['@type'];
    
    if (!details.hasContext) {
      details.errors.push('@context is missing');
    }
    if (!details.hasType) {
      details.errors.push('@type is missing');
    }
    
    details.isValid = details.hasContext && details.hasType;
  } catch (error) {
    details.errors.push(`JSON parse error: ${error.message}`);
  }

  return details;
}

module.exports = router;
