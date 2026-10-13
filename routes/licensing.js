const express = require('express');
const { body } = require('express-validator');
const Licensing = require('../models/Licensing');
const { protect, authorize } = require('../middleware/auth');
const { validate, asyncHandler } = require('../middleware/helpers');

const router = express.Router();

/**
 * @route   GET /api/v1/licensing
 * @desc    Get licensing information
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const licensing = await Licensing.getInfo();

  res.json({
    success: true,
    data: licensing
  });
}));

/**
 * @route   PUT /api/v1/licensing
 * @desc    Update licensing information
 * @access  Private/Admin
 */
router.put('/',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    let licensing = await Licensing.findOne();

    if (!licensing) {
      licensing = await Licensing.create(req.body);
    } else {
      licensing = await Licensing.findByIdAndUpdate(licensing._id, req.body, {
        new: true,
        runValidators: true
      });
    }

    res.json({
      success: true,
      message: 'Licensing information updated successfully',
      data: licensing
    });
  })
);

/**
 * @route   POST /api/v1/licensing/documents
 * @desc    Add a licensing document
 * @access  Private/Admin
 */
router.post('/documents',
  protect,
  authorize('admin', 'editor'),
  [
    body('title').trim().notEmpty().withMessage('Document title is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const licensing = await Licensing.getInfo();

    licensing.documents.push(req.body);
    await licensing.save();

    res.status(201).json({
      success: true,
      message: 'Document added successfully',
      data: licensing.documents
    });
  })
);

/**
 * @route   PUT /api/v1/licensing/documents/:docId
 * @desc    Update a licensing document
 * @access  Private/Admin
 */
router.put('/documents/:docId',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const licensing = await Licensing.getInfo();
    
    const docIndex = licensing.documents.findIndex(
      doc => doc._id.toString() === req.params.docId
    );

    if (docIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    licensing.documents[docIndex] = {
      ...licensing.documents[docIndex].toObject(),
      ...req.body
    };
    await licensing.save();

    res.json({
      success: true,
      message: 'Document updated successfully',
      data: licensing.documents
    });
  })
);

/**
 * @route   DELETE /api/v1/licensing/documents/:docId
 * @desc    Delete a licensing document
 * @access  Private/Admin
 */
router.delete('/documents/:docId',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const licensing = await Licensing.getInfo();
    
    licensing.documents = licensing.documents.filter(
      doc => doc._id.toString() !== req.params.docId
    );
    await licensing.save();

    res.json({
      success: true,
      message: 'Document deleted successfully',
      data: licensing.documents
    });
  })
);

/**
 * @route   POST /api/v1/licensing/features
 * @desc    Add a licensing feature
 * @access  Private/Admin
 */
router.post('/features',
  protect,
  authorize('admin', 'editor'),
  [
    body('title').trim().notEmpty().withMessage('Feature title is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const licensing = await Licensing.getInfo();

    licensing.features.push(req.body);
    await licensing.save();

    res.status(201).json({
      success: true,
      message: 'Feature added successfully',
      data: licensing.features
    });
  })
);

/**
 * @route   DELETE /api/v1/licensing/features/:featureId
 * @desc    Delete a licensing feature
 * @access  Private/Admin
 */
router.delete('/features/:featureId',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const licensing = await Licensing.getInfo();
    
    licensing.features = licensing.features.filter(
      feature => feature._id.toString() !== req.params.featureId
    );
    await licensing.save();

    res.json({
      success: true,
      message: 'Feature deleted successfully',
      data: licensing.features
    });
  })
);

module.exports = router;
