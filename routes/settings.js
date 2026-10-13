const express = require('express');
const Settings = require('../models/Settings');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/helpers');

const router = express.Router();

/**
 * @route   GET /api/v1/settings
 * @desc    Get site settings
 * @access  Public (limited) / Private (full)
 */
router.get('/', asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();

  // Return limited settings for public
  const publicSettings = {
    siteName: settings.siteName,
    siteDescription: settings.siteDescription,
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    theme: settings.theme,
    showSplashScreen: settings.showSplashScreen,
    splashDuration: settings.splashDuration,
    splashScreenVariant: settings.splashScreenVariant,
    splashScreenTheme: settings.splashScreenTheme,
    splashShowOnce: settings.splashShowOnce,
    heroAutoSlide: settings.heroAutoSlide,
    heroSlideInterval: settings.heroSlideInterval,
    homeNewsLimit: settings.homeNewsLimit,
    homeMoviesLimit: settings.homeMoviesLimit,
    homeProducersLimit: settings.homeProducersLimit,
    socialLinksFooter: settings.socialLinksFooter,
    enableAnalytics: settings.enableAnalytics, // Include analytics status
    sections: settings.sections // Include section visibility settings
  };

  res.json({
    success: true,
    data: publicSettings
  });
}));

/**
 * @route   GET /api/v1/settings/admin
 * @desc    Get all settings for admin
 * @access  Private/Admin
 */
router.get('/admin', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const settings = await Settings.getSettings();

  res.json({
    success: true,
    data: settings
  });
}));

/**
 * @route   PUT /api/v1/settings
 * @desc    Update site settings
 * @access  Private/Admin
 */
router.put('/',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      settings = await Settings.findByIdAndUpdate(settings._id, req.body, {
        new: true,
        runValidators: true
      });
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  })
);

/**
 * @route   PUT /api/v1/settings/maintenance
 * @desc    Toggle maintenance mode
 * @access  Private/Admin
 */
router.put('/maintenance',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSettings();
    const { enabled, message } = req.body;

    settings.maintenanceMode = enabled !== undefined ? enabled : !settings.maintenanceMode;
    if (message) settings.maintenanceMessage = message;
    await settings.save();

    res.json({
      success: true,
      message: `Maintenance mode ${settings.maintenanceMode ? 'enabled' : 'disabled'}`,
      data: {
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage
      }
    });
  })
);

/**
 * @route   PUT /api/v1/settings/splash
 * @desc    Update splash screen settings
 * @access  Private/Admin
 */
router.put('/splash',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSettings();
    const { enabled, duration } = req.body;

    if (enabled !== undefined) settings.showSplashScreen = enabled;
    if (duration) settings.splashDuration = duration;
    await settings.save();

    res.json({
      success: true,
      message: 'Splash screen settings updated',
      data: {
        showSplashScreen: settings.showSplashScreen,
        splashDuration: settings.splashDuration
      }
    });
  })
);

/**
 * @route   PUT /api/v1/settings/seo
 * @desc    Update default SEO settings
 * @access  Private/Admin
 */
router.put('/seo',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSettings();
    const { title, description, keywords } = req.body;

    if (title) settings.defaultSeoTitle = title;
    if (description) settings.defaultSeoDescription = description;
    if (keywords) settings.defaultSeoKeywords = keywords;
    await settings.save();

    res.json({
      success: true,
      message: 'SEO settings updated',
      data: {
        defaultSeoTitle: settings.defaultSeoTitle,
        defaultSeoDescription: settings.defaultSeoDescription,
        defaultSeoKeywords: settings.defaultSeoKeywords
      }
    });
  })
);

/**
 * @route   PUT /api/v1/settings/analytics
 * @desc    Update analytics settings
 * @access  Private/Admin
 */
router.put('/analytics',
  protect,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSettings();
    const { googleAnalyticsId, facebookPixelId } = req.body;

    if (googleAnalyticsId !== undefined) settings.googleAnalyticsId = googleAnalyticsId;
    if (facebookPixelId !== undefined) settings.facebookPixelId = facebookPixelId;
    await settings.save();

    res.json({
      success: true,
      message: 'Analytics settings updated',
      data: {
        googleAnalyticsId: settings.googleAnalyticsId,
        facebookPixelId: settings.facebookPixelId
      }
    });
  })
);

module.exports = router;
