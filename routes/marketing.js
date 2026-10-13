const express = require('express');
const { body } = require('express-validator');
const Marketing = require('../models/Marketing');
const { protect, authorize } = require('../middleware/auth');
const { validate, asyncHandler } = require('../middleware/helpers');

const router = express.Router();

/**
 * @route   GET /api/v1/marketing
 * @desc    Get marketing/partners information
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const marketing = await Marketing.getInfo();

  res.json({
    success: true,
    data: marketing
  });
}));

/**
 * @route   PUT /api/v1/marketing
 * @desc    Update marketing information
 * @access  Private/Admin
 */
router.put('/',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    let marketing = await Marketing.findOne();

    if (!marketing) {
      marketing = await Marketing.create(req.body);
    } else {
      marketing = await Marketing.findByIdAndUpdate(marketing._id, req.body, {
        new: true,
        runValidators: true
      });
    }

    res.json({
      success: true,
      message: 'Marketing information updated successfully',
      data: marketing
    });
  })
);

// ==================== PARTNERS ====================

/**
 * @route   POST /api/v1/marketing/partners
 * @desc    Add a partner
 * @access  Private/Admin
 */
router.post('/partners',
  protect,
  authorize('admin', 'editor'),
  [
    body('name').trim().notEmpty().withMessage('Partner name is required'),
    body('type').trim().notEmpty().withMessage('Partner type is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const marketing = await Marketing.getInfo();

    marketing.partners.push(req.body);
    await marketing.save();

    res.status(201).json({
      success: true,
      message: 'Partner added successfully',
      data: marketing.partners
    });
  })
);

/**
 * @route   PUT /api/v1/marketing/partners/:partnerId
 * @desc    Update a partner
 * @access  Private/Admin
 */
router.put('/partners/:partnerId',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const marketing = await Marketing.getInfo();
    
    const partnerIndex = marketing.partners.findIndex(
      p => p._id.toString() === req.params.partnerId
    );

    if (partnerIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Partner not found'
      });
    }

    marketing.partners[partnerIndex] = {
      ...marketing.partners[partnerIndex].toObject(),
      ...req.body
    };
    await marketing.save();

    res.json({
      success: true,
      message: 'Partner updated successfully',
      data: marketing.partners
    });
  })
);

/**
 * @route   DELETE /api/v1/marketing/partners/:partnerId
 * @desc    Delete a partner
 * @access  Private/Admin
 */
router.delete('/partners/:partnerId',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const marketing = await Marketing.getInfo();
    
    marketing.partners = marketing.partners.filter(
      p => p._id.toString() !== req.params.partnerId
    );
    await marketing.save();

    res.json({
      success: true,
      message: 'Partner deleted successfully',
      data: marketing.partners
    });
  })
);

// ==================== PROMO VIDEOS ====================

/**
 * @route   POST /api/v1/marketing/promo-videos
 * @desc    Add a promo video
 * @access  Private/Admin
 */
router.post('/promo-videos',
  protect,
  authorize('admin', 'editor'),
  [
    body('title').trim().notEmpty().withMessage('Video title is required'),
    body('url').trim().notEmpty().withMessage('Video URL is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const marketing = await Marketing.getInfo();

    marketing.promoVideos.push(req.body);
    await marketing.save();

    res.status(201).json({
      success: true,
      message: 'Promo video added successfully',
      data: marketing.promoVideos
    });
  })
);

/**
 * @route   DELETE /api/v1/marketing/promo-videos/:videoId
 * @desc    Delete a promo video
 * @access  Private/Admin
 */
router.delete('/promo-videos/:videoId',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const marketing = await Marketing.getInfo();
    
    marketing.promoVideos = marketing.promoVideos.filter(
      v => v._id.toString() !== req.params.videoId
    );
    await marketing.save();

    res.json({
      success: true,
      message: 'Promo video deleted successfully',
      data: marketing.promoVideos
    });
  })
);

// ==================== TESTIMONIALS ====================

/**
 * @route   POST /api/v1/marketing/testimonials
 * @desc    Add a testimonial
 * @access  Private/Admin
 */
router.post('/testimonials',
  protect,
  authorize('admin', 'editor'),
  [
    body('quote').trim().notEmpty().withMessage('Quote is required'),
    body('author').trim().notEmpty().withMessage('Author name is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    const marketing = await Marketing.getInfo();

    marketing.testimonials.push(req.body);
    await marketing.save();

    res.status(201).json({
      success: true,
      message: 'Testimonial added successfully',
      data: marketing.testimonials
    });
  })
);

/**
 * @route   PUT /api/v1/marketing/testimonials/:testimonialId
 * @desc    Update a testimonial
 * @access  Private/Admin
 */
router.put('/testimonials/:testimonialId',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    const marketing = await Marketing.getInfo();
    
    const index = marketing.testimonials.findIndex(
      t => t._id.toString() === req.params.testimonialId
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    marketing.testimonials[index] = {
      ...marketing.testimonials[index].toObject(),
      ...req.body
    };
    await marketing.save();

    res.json({
      success: true,
      message: 'Testimonial updated successfully',
      data: marketing.testimonials
    });
  })
);

/**
 * @route   DELETE /api/v1/marketing/testimonials/:testimonialId
 * @desc    Delete a testimonial
 * @access  Private/Admin
 */
router.delete('/testimonials/:testimonialId',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const marketing = await Marketing.getInfo();
    
    marketing.testimonials = marketing.testimonials.filter(
      t => t._id.toString() !== req.params.testimonialId
    );
    await marketing.save();

    res.json({
      success: true,
      message: 'Testimonial deleted successfully',
      data: marketing.testimonials
    });
  })
);

module.exports = router;
