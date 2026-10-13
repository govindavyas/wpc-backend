const express = require('express');
const { body } = require('express-validator');
const TeamMember = require('../models/TeamMember');
const { protect, authorize } = require('../middleware/auth');
const { validate, asyncHandler } = require('../middleware/helpers');

const router = express.Router();

/**
 * @route   GET /api/v1/team
 * @desc    Get all team members
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const { featured, showOnHomepage, role } = req.query;

  const queryObj = { isActive: true };
  if (featured === 'true') queryObj.featured = true;
  if (showOnHomepage === 'true') queryObj.showOnHomepage = true;
  if (role) queryObj.role = role;

  const teamMembers = await TeamMember.find(queryObj)
    .sort({ order: 1, createdAt: 1 });

  res.json({
    success: true,
    count: teamMembers.length,
    data: teamMembers
  });
}));

/**
 * @route   GET /api/v1/team/homepage
 * @desc    Get team members for homepage
 * @access  Public
 */
router.get('/homepage', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 4;

  const teamMembers = await TeamMember.find({ isActive: true, showOnHomepage: true })
    .sort({ order: 1 })
    .limit(limit);

  res.json({
    success: true,
    count: teamMembers.length,
    data: teamMembers
  });
}));

/**
 * @route   GET /api/v1/team/roles
 * @desc    Get available role options
 * @access  Public
 */
router.get('/roles', asyncHandler(async (req, res) => {
  const roles = [
    'Producer',
    'Executive Producer',
    'Co-Producer',
    'Associate Producer',
    'Line Producer',
    'Director',
    'Writer',
    'Actor',
    'Editor',
    'Cinematographer',
    'Music Director',
    'Sound Designer',
    'Art Director',
    'Costume Designer',
    'VFX Supervisor',
    'Other'
  ];

  res.json({
    success: true,
    data: roles
  });
}));

/**
 * @route   GET /api/v1/team/by-role/:role
 * @desc    Get team members by specific role
 * @access  Public
 */
router.get('/by-role/:role', asyncHandler(async (req, res) => {
  const { role } = req.params;
  
  const teamMembers = await TeamMember.find({ 
    isActive: true, 
    role: role 
  }).sort({ order: 1, createdAt: 1 });

  res.json({
    success: true,
    count: teamMembers.length,
    data: teamMembers
  });
}));

/**
 * @route   GET /api/v1/team/admin
 * @desc    Get all team members for admin
 * @access  Private/Admin
 */
router.get('/admin', protect, authorize('admin', 'editor'), asyncHandler(async (req, res) => {
  const { role } = req.query;
  
  const queryObj = {};
  if (role) queryObj.role = role;

  const teamMembers = await TeamMember.find(queryObj).sort({ order: 1, createdAt: -1 });

  res.json({
    success: true,
    count: teamMembers.length,
    data: teamMembers
  });
}));

/**
 * @route   GET /api/v1/team/slug/:slug
 * @desc    Get team member by slug
 * @access  Public
 */
router.get('/slug/:slug', asyncHandler(async (req, res) => {
  const teamMember = await TeamMember.findOne({ 
    slug: req.params.slug, 
    isActive: true 
  });

  if (!teamMember) {
    return res.status(404).json({
      success: false,
      message: 'Team member not found'
    });
  }

  res.json({
    success: true,
    data: teamMember
  });
}));

/**
 * @route   GET /api/v1/team/:id
 * @desc    Get single team member
 * @access  Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  let teamMember = await TeamMember.findById(req.params.id).catch(() => null);
  if (!teamMember) {
    teamMember = await TeamMember.findOne({ slug: req.params.id, isActive: true });
  }

  if (!teamMember) {
    return res.status(404).json({
      success: false,
      message: 'Team member not found'
    });
  }

  res.json({
    success: true,
    data: teamMember
  });
}));

/**
 * @route   POST /api/v1/team
 * @desc    Create a new team member
 * @access  Private/Admin
 */
router.post('/',
  protect,
  authorize('admin', 'editor'),
  [
    body('name').trim().notEmpty().withMessage('Team member name is required'),
    body('role').notEmpty().withMessage('Role is required'),
    body('customRole').optional().trim(),
    validate
  ],
  asyncHandler(async (req, res) => {
    // If role is 'Other' but no customRole provided, reject
    if (req.body.role === 'Other' && !req.body.customRole) {
      return res.status(400).json({
        success: false,
        message: 'Custom role is required when selecting "Other"'
      });
    }

    const teamMember = await TeamMember.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Team member created successfully',
      data: teamMember
    });
  })
);

/**
 * @route   PUT /api/v1/team/:id
 * @desc    Update a team member
 * @access  Private/Admin
 */
router.put('/:id',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    let teamMember = await TeamMember.findById(req.params.id);

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    // If role is 'Other' but no customRole provided, reject
    if (req.body.role === 'Other' && !req.body.customRole) {
      return res.status(400).json({
        success: false,
        message: 'Custom role is required when selecting "Other"'
      });
    }

    // Clear customRole if role is not 'Other'
    if (req.body.role && req.body.role !== 'Other') {
      req.body.customRole = null;
    }

    teamMember = await TeamMember.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      message: 'Team member updated successfully',
      data: teamMember
    });
  })
);

/**
 * @route   DELETE /api/v1/team/:id
 * @desc    Delete a team member (soft delete)
 * @access  Private/Admin
 */
router.delete('/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const teamMember = await TeamMember.findById(req.params.id);

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found'
      });
    }

    teamMember.isActive = false;
    await teamMember.save();

    res.json({
      success: true,
      message: 'Team member deleted successfully'
    });
  })
);

/**
 * @route   PUT /api/v1/team/reorder
 * @desc    Reorder team members
 * @access  Private/Admin
 */
router.put('/reorder',
  protect,
  authorize('admin', 'editor'),
  [
    body('orders').isArray().withMessage('Orders array is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const { orders } = req.body;

    // Update order for each team member
    const updates = orders.map(item => 
      TeamMember.findByIdAndUpdate(item.id, { order: item.order })
    );

    await Promise.all(updates);

    res.json({
      success: true,
      message: 'Team members reordered successfully'
    });
  })
);

module.exports = router;
