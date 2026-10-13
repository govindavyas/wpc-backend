const express = require('express');
const { body } = require('express-validator');
const Navigation = require('../models/Navigation');
const { protect, authorize } = require('../middleware/auth');
const { validate, asyncHandler } = require('../middleware/helpers');

const router = express.Router();

/**
 * @route   GET /api/v1/navigation
 * @desc    Get navigation structure
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const navigation = await Navigation.getInfo();

  res.json({
    success: true,
    data: navigation
  });
}));

/**
 * @route   GET /api/v1/navigation/main
 * @desc    Get main navigation only
 * @access  Public
 */
router.get('/main', asyncHandler(async (req, res) => {
  const navigation = await Navigation.getInfo();

  res.json({
    success: true,
    data: navigation.mainNavigation.filter(item => item.isActive).sort((a, b) => a.order - b.order)
  });
}));

/**
 * @route   GET /api/v1/navigation/dropdown
 * @desc    Get dropdown navigation only
 * @access  Public
 */
router.get('/dropdown', asyncHandler(async (req, res) => {
  const navigation = await Navigation.getInfo();

  res.json({
    success: true,
    data: navigation.dropdownNavigation.filter(item => item.isActive).sort((a, b) => a.order - b.order)
  });
}));

/**
 * @route   PUT /api/v1/navigation
 * @desc    Update full navigation structure
 * @access  Private/Admin
 */
router.put('/',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    let navigation = await Navigation.findOne();

    if (!navigation) {
      navigation = await Navigation.create(req.body);
    } else {
      navigation = await Navigation.findByIdAndUpdate(navigation._id, req.body, {
        new: true,
        runValidators: true
      });
    }

    res.json({
      success: true,
      message: 'Navigation updated successfully',
      data: navigation
    });
  })
);

/**
 * @route   PUT /api/v1/navigation/main
 * @desc    Update main navigation
 * @access  Private/Admin
 */
router.put('/main',
  protect,
  authorize('admin'),
  [
    body('items').isArray().withMessage('Items array is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const navigation = await Navigation.getInfo();
    
    navigation.mainNavigation = req.body.items;
    await navigation.save();

    res.json({
      success: true,
      message: 'Main navigation updated successfully',
      data: navigation.mainNavigation
    });
  })
);

/**
 * @route   PUT /api/v1/navigation/dropdown
 * @desc    Update dropdown navigation
 * @access  Private/Admin
 */
router.put('/dropdown',
  protect,
  authorize('admin'),
  [
    body('items').isArray().withMessage('Items array is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const navigation = await Navigation.getInfo();
    
    navigation.dropdownNavigation = req.body.items;
    await navigation.save();

    res.json({
      success: true,
      message: 'Dropdown navigation updated successfully',
      data: navigation.dropdownNavigation
    });
  })
);

/**
 * @route   POST /api/v1/navigation/main/item
 * @desc    Add item to main navigation
 * @access  Private/Admin
 */
router.post('/main/item',
  protect,
  authorize('admin'),
  [
    body('label').trim().notEmpty().withMessage('Label is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const navigation = await Navigation.getInfo();
    
    // Get max order
    const maxOrder = navigation.mainNavigation.reduce(
      (max, item) => Math.max(max, item.order || 0), 0
    );
    
    navigation.mainNavigation.push({
      ...req.body,
      order: maxOrder + 1
    });
    await navigation.save();

    res.status(201).json({
      success: true,
      message: 'Navigation item added successfully',
      data: navigation.mainNavigation
    });
  })
);

/**
 * @route   POST /api/v1/navigation/dropdown/item
 * @desc    Add item to dropdown navigation
 * @access  Private/Admin
 */
router.post('/dropdown/item',
  protect,
  authorize('admin'),
  [
    body('label').trim().notEmpty().withMessage('Label is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const navigation = await Navigation.getInfo();
    
    const maxOrder = navigation.dropdownNavigation.reduce(
      (max, item) => Math.max(max, item.order || 0), 0
    );
    
    navigation.dropdownNavigation.push({
      ...req.body,
      order: maxOrder + 1
    });
    await navigation.save();

    res.status(201).json({
      success: true,
      message: 'Dropdown item added successfully',
      data: navigation.dropdownNavigation
    });
  })
);

/**
 * @route   DELETE /api/v1/navigation/main/:itemId
 * @desc    Delete item from main navigation
 * @access  Private/Admin
 */
router.delete('/main/:itemId',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const navigation = await Navigation.getInfo();
    
    navigation.mainNavigation = navigation.mainNavigation.filter(
      item => item._id.toString() !== req.params.itemId
    );
    await navigation.save();

    res.json({
      success: true,
      message: 'Navigation item deleted successfully',
      data: navigation.mainNavigation
    });
  })
);

/**
 * @route   DELETE /api/v1/navigation/dropdown/:itemId
 * @desc    Delete item from dropdown navigation
 * @access  Private/Admin
 */
router.delete('/dropdown/:itemId',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const navigation = await Navigation.getInfo();
    
    navigation.dropdownNavigation = navigation.dropdownNavigation.filter(
      item => item._id.toString() !== req.params.itemId
    );
    await navigation.save();

    res.json({
      success: true,
      message: 'Dropdown item deleted successfully',
      data: navigation.dropdownNavigation
    });
  })
);

module.exports = router;
