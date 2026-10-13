const express = require('express');
const { body } = require('express-validator');
const CompanyInfo = require('../models/CompanyInfo');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const { validate, asyncHandler } = require('../middleware/helpers');

const router = express.Router();

/**
 * @route   GET /api/v1/company
 * @desc    Get company information
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const company = await CompanyInfo.getInfo();

  res.json({
    success: true,
    data: company
  });
}));

/**
 * @route   PUT /api/v1/company
 * @desc    Update company information
 * @access  Private/Admin
 */
router.put('/',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    let company = await CompanyInfo.findOne();

    if (!company) {
      company = await CompanyInfo.create(req.body);
    } else {
      company = await CompanyInfo.findByIdAndUpdate(company._id, req.body, {
        new: true,
        runValidators: true
      });
    }

    res.json({
      success: true,
      message: 'Company information updated successfully',
      data: company
    });
  })
);

/**
 * @route   PUT /api/v1/company/about
 * @desc    Update about us section
 * @access  Private/Admin
 */
router.put('/about',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    let company = await CompanyInfo.getInfo();

    company.aboutUs = {
      ...company.aboutUs,
      ...req.body
    };

    await company.save();

    res.json({
      success: true,
      message: 'About Us section updated successfully',
      data: company.aboutUs
    });
  })
);

/**
 * @route   PUT /api/v1/company/contact
 * @desc    Update contact information
 * @access  Private/Admin
 */
router.put('/contact',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    let company = await CompanyInfo.getInfo();

    company.contact = {
      ...company.contact,
      ...req.body
    };

    await company.save();

    res.json({
      success: true,
      message: 'Contact information updated successfully',
      data: company.contact
    });
  })
);

/**
 * @route   PUT /api/v1/company/social
 * @desc    Update social links
 * @access  Private/Admin
 */
router.put('/social',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    let company = await CompanyInfo.getInfo();

    company.socialLinks = {
      ...company.socialLinks,
      ...req.body
    };

    await company.save();

    res.json({
      success: true,
      message: 'Social links updated successfully',
      data: company.socialLinks
    });
  })
);

/**
 * @route   POST /api/v1/company/about/sections
 * @desc    Add a section to about us
 * @access  Private/Admin
 */
router.post('/about/sections',
  protect,
  authorize('admin', 'editor'),
  [
    body('title').trim().notEmpty().withMessage('Section title is required'),
    body('description').trim().notEmpty().withMessage('Section description is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    let company = await CompanyInfo.getInfo();

    if (!company.aboutUs.sections) {
      company.aboutUs.sections = [];
    }

    company.aboutUs.sections.push(req.body);
    await company.save();

    res.status(201).json({
      success: true,
      message: 'Section added successfully',
      data: company.aboutUs.sections
    });
  })
);

/**
 * @route   DELETE /api/v1/company/about/sections/:index
 * @desc    Delete a section from about us
 * @access  Private/Admin
 */
router.delete('/about/sections/:index',
  protect,
  authorize('admin', 'editor'),
  asyncHandler(async (req, res) => {
    let company = await CompanyInfo.getInfo();
    const index = parseInt(req.params.index);

    if (index < 0 || index >= company.aboutUs.sections.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid section index'
      });
    }

    company.aboutUs.sections.splice(index, 1);
    await company.save();

    res.json({
      success: true,
      message: 'Section deleted successfully',
      data: company.aboutUs.sections
    });
  })
);

/**
 * @route   POST /api/v1/company/about/stats
 * @desc    Add a stat to about us
 * @access  Private/Admin
 */
router.post('/about/stats',
  protect,
  authorize('admin', 'editor'),
  [
    body('value').trim().notEmpty().withMessage('Stat value is required'),
    body('label').trim().notEmpty().withMessage('Stat label is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    let company = await CompanyInfo.getInfo();

    if (!company.aboutUs.stats) {
      company.aboutUs.stats = [];
    }

    company.aboutUs.stats.push(req.body);
    await company.save();

    res.status(201).json({
      success: true,
      message: 'Stat added successfully',
      data: company.aboutUs.stats
    });
  })
);

/**
 * @route   POST /api/v1/company/about/milestones
 * @desc    Add a milestone to about us
 * @access  Private/Admin
 */
router.post('/about/milestones',
  protect,
  authorize('admin', 'editor'),
  [
    body('year').trim().notEmpty().withMessage('Milestone year is required'),
    body('title').trim().notEmpty().withMessage('Milestone title is required'),
    validate
  ],
  asyncHandler(async (req, res) => {
    let company = await CompanyInfo.getInfo();

    if (!company.aboutUs.milestones) {
      company.aboutUs.milestones = [];
    }

    company.aboutUs.milestones.push(req.body);
    await company.save();

    res.status(201).json({
      success: true,
      message: 'Milestone added successfully',
      data: company.aboutUs.milestones
    });
  })
);

module.exports = router;
