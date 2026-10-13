const express = require('express');
const { body } = require('express-validator');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { validate, asyncHandler } = require('../middleware/helpers');

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user (admin only)
 * @access  Private/Admin
 */
router.post('/register',
  protect,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['admin', 'editor', 'viewer']).withMessage('Invalid role'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const user = await User.create({ name, email, password, role });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  })
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Contact administrator.'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = user.generateToken();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar
        }
      }
    });
  })
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current logged in user
 * @access  Private
 */
router.get('/me', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  res.json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    }
  });
}));

/**
 * @route   PUT /api/v1/auth/updateprofile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/updateprofile',
  protect,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
      avatar: req.body.avatar
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(key => 
      fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  })
);

/**
 * @route   PUT /api/v1/auth/updatepassword
 * @desc    Update password
 * @access  Private
 */
router.put('/updatepassword',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(req.body.currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    user.password = req.body.newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    // Generate new token
    const token = user.generateToken();

    res.json({
      success: true,
      message: 'Password updated successfully',
      data: { token }
    });
  })
);

/**
 * @route   GET /api/v1/auth/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get('/users', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const users = await User.find().select('-password').sort({ createdAt: -1 });

  res.json({
    success: true,
    count: users.length,
    data: users
  });
}));

/**
 * @route   PUT /api/v1/auth/users/:id
 * @desc    Update user (admin only)
 * @access  Private/Admin
 */
router.put('/users/:id',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const { name, email, role, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, isActive },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  })
);

/**
 * @route   DELETE /api/v1/auth/users/:id
 * @desc    Delete user (admin only)
 * @access  Private/Admin
 */
router.delete('/users/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  // Prevent deleting self
  if (req.params.id === req.user.id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete your own account'
    });
  }

  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
}));

module.exports = router;
