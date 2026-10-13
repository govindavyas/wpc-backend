const express = require('express');
const { body, param, query } = require('express-validator');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Feed = require('../models/Feed');
const FeedInteraction = require('../models/FeedInteraction');
const likeEmitter = require('../utils/likeEmitter');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { validate, asyncHandler } = require('../middleware/helpers');

const router = express.Router();

// ============================================
// Platform Detection & oEmbed Configuration
// ============================================

const PLATFORM_PATTERNS = {
  instagram: [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?instagr\.am\/p\/([A-Za-z0-9_-]+)/
  ],
  youtube: [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]+)/,
    /(?:https?:\/\/)?youtu\.be\/([A-Za-z0-9_-]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([A-Za-z0-9_-]+)/
  ],
  facebook: [
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/(?:watch\/?\?v=|.*\/videos\/|video\.php\?v=)(\d+)/,
    /(?:https?:\/\/)?(?:www\.)?facebook\.com\/.*\/posts\/(\d+)/,
    /(?:https?:\/\/)?(?:www\.)?fb\.watch\/([A-Za-z0-9_-]+)/
  ],
  twitter: [
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/
  ],
  vimeo: [
    /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/,
    /(?:https?:\/\/)?player\.vimeo\.com\/video\/(\d+)/
  ],
  tiktok: [
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    /(?:https?:\/\/)?(?:vm\.)?tiktok\.com\/([A-Za-z0-9]+)/
  ],
  linkedin: [
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/posts\/[\w-]+/,
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/embed\/feed\/update/
  ]
};

const OEMBED_ENDPOINTS = {
  instagram: 'https://graph.facebook.com/v18.0/instagram_oembed',
  youtube: 'https://www.youtube.com/oembed',
  facebook: 'https://graph.facebook.com/v18.0/oembed_video',
  twitter: 'https://publish.twitter.com/oembed',
  vimeo: 'https://vimeo.com/api/oembed.json',
  tiktok: 'https://www.tiktok.com/oembed'
};

/**
 * Detect platform from URL
 */
function detectPlatform(url) {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { platform, embedId: match[1] || '' };
      }
    }
  }
  return { platform: 'other', embedId: '' };
}

/**
 * Detect content type from URL and platform
 */
function detectContentType(url, platform) {
  const videoIndicators = ['video', 'watch', 'reel', 'shorts', 'tv', 'vimeo', 'tiktok'];
  const lowerUrl = url.toLowerCase();
  
  if (platform === 'youtube' || platform === 'vimeo' || platform === 'tiktok') {
    return 'video';
  }
  
  if (videoIndicators.some(indicator => lowerUrl.includes(indicator))) {
    return 'video';
  }
  
  if (platform === 'instagram' && lowerUrl.includes('/p/')) {
    return 'image'; // Instagram posts are typically images
  }
  
  return 'mixed';
}

/**
 * Fetch oEmbed data for a URL
 */
async function fetchOEmbed(url, platform) {
  const endpoint = OEMBED_ENDPOINTS[platform];
  if (!endpoint) {
    return null;
  }

  try {
    const params = new URLSearchParams({
      url,
      format: 'json',
      maxwidth: 550,
      omitscript: true
    });

    // For Instagram/Facebook, we need access token (use app token if configured)
    if ((platform === 'instagram' || platform === 'facebook') && process.env.FACEBOOK_APP_TOKEN) {
      params.append('access_token', process.env.FACEBOOK_APP_TOKEN);
    }

    const response = await fetch(`${endpoint}?${params.toString()}`);
    
    if (!response.ok) {
      console.error(`oEmbed fetch failed for ${platform}:`, response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`oEmbed fetch error for ${platform}:`, error.message);
    return null;
  }
}

/**
 * Generate fallback embed HTML
 */
function generateFallbackEmbed(url, platform, embedId) {
  switch (platform) {
    case 'youtube':
      return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${embedId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    
    case 'vimeo':
      return `<iframe src="https://player.vimeo.com/video/${embedId}" width="560" height="315" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    
    case 'twitter':
      return `<blockquote class="twitter-tweet" data-dnt="true"><a href="${url}"></a></blockquote>`;
    
    case 'instagram':
      return `<blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14"></blockquote>`;
    
    case 'tiktok':
      return `<blockquote class="tiktok-embed" cite="${url}" data-video-id="${embedId}"></blockquote>`;
    
    case 'facebook':
      return `<div class="fb-video" data-href="${url}" data-width="auto" data-show-text="false"></div>`;
    
    default:
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  }
}

/**
 * Hash IP address for privacy
 */
function hashIP(ip) {
  return crypto.createHash('sha256').update(ip + process.env.JWT_SECRET).digest('hex').substring(0, 32);
}

/**
 * Detect device type from user agent
 */
function detectDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    return 'mobile';
  }
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Sanitize embed HTML to prevent XSS
 */
function sanitizeEmbedHtml(html, platform) {
  if (!html) return '';
  
  // Only allow specific tags and attributes based on platform
  const allowedTags = ['iframe', 'blockquote', 'a', 'script', 'div'];
  const allowedDomains = [
    'youtube.com', 'youtube-nocookie.com', 'youtu.be',
    'vimeo.com', 'player.vimeo.com',
    'instagram.com',
    'twitter.com', 'platform.twitter.com',
    'facebook.com', 'connect.facebook.net',
    'tiktok.com'
  ];
  
  // Basic XSS prevention - in production, use a proper sanitizer like DOMPurify
  let sanitized = html
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<script(?!.*(?:instagram|twitter|tiktok|facebook))/gi, '&lt;script');
  
  return sanitized;
}

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   GET /api/v1/feed
 * @desc    Get published feed items (public)
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, platform } = req.query;
  
  const query = { status: 'published', isValid: true };
  if (platform && platform !== 'all') {
    query.platform = platform;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [items, total] = await Promise.all([
    Feed.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-analytics -createdBy -oembedData'),
    Feed.countDocuments(query)
  ]);

  res.json({
    success: true,
    count: items.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: items
  });
}));

/**
 * @route   GET /api/v1/feed/:id
 * @desc    Get single feed item (public)
 * @access  Public
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const item = await Feed.findOne({ 
    _id: req.params.id, 
    status: 'published',
    isValid: true 
  }).select('-analytics -createdBy -oembedData');

  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Feed item not found'
    });
  }

  // Increment view count
  await Feed.findByIdAndUpdate(req.params.id, {
    $inc: { 'analytics.views': 1 }
  });

  res.json({
    success: true,
    data: item
  });
}));

/**
 * Validate device ID format (UUID v4)
 */
function isValidDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId);
}

/**
 * @route   POST /api/v1/feed/:id/like
 * @desc    Like a feed item (device-based, no auth required)
 * @access  Public
 * 
 * Request body:
 *   - deviceId: string (required) - UUID v4 generated on client
 * 
 * Response:
 *   - success: boolean
 *   - hasLiked: boolean - Whether this device has liked the item
 *   - likeCount: number - Current total like count
 *   - message: string
 */
router.post('/:id/like', asyncHandler(async (req, res) => {
  const { deviceId } = req.body;

  // Validate device ID
  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({
      success: false,
      message: 'Valid device ID is required',
      error: 'INVALID_DEVICE_ID'
    });
  }

  // Convert ID to ObjectId for consistent MongoDB queries
  const feedItemId = new mongoose.Types.ObjectId(req.params.id);

  // Verify feed item exists and is published
  const feedItem = await Feed.findOne({ 
    _id: feedItemId, 
    status: 'published' 
  });

  if (!feedItem) {
    return res.status(404).json({
      success: false,
      message: 'Feed item not found',
      error: 'ITEM_NOT_FOUND'
    });
  }

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const ipHash = hashIP(ip);
  
  const userData = {
    deviceId,
    ipHash,
    userAgent: req.headers['user-agent'] || '',
    deviceType: detectDeviceType(req.headers['user-agent']),
    country: req.headers['cf-ipcountry'] || ''
  };

  const result = await FeedInteraction.recordLike(feedItemId, userData);

  console.log('✅ Like recorded:', {
    feedItemId: feedItemId.toString(),
    deviceId,
    alreadyLiked: result.alreadyLiked,
    newLikeCount: result.likeCount,
    message: result.message,
    wasIncreased: result.alreadyLiked ? '❌ NO (duplicate blocked)' : '✅ YES (+1)'
  });

  // Emit like event for admin listeners (include whether it was a new increment)
  try {
    const wasNewLike = !result.alreadyLiked;
    likeEmitter.emit('like', {
      feedItemId: feedItemId.toString(),
      likeCount: result.likeCount,
      alreadyLiked: !!result.alreadyLiked
    });
    console.log('🔌 Like event emitted:', {
      feedItemId: feedItemId.toString(),
      newCount: result.likeCount,
      alreadyLiked: result.alreadyLiked,
      wasNewLike
    });
  } catch (err) {
    console.error('Failed to emit like event:', err.message)
  }

  res.json({
    success: true,
    hasLiked: true, // Device has liked after this call
    alreadyLiked: result.alreadyLiked,
    likeCount: result.likeCount,
    message: result.message
  });
}));

/**
 * Server-Sent Events stream for admin clients to receive live like updates
 * Auth via token query param (EventSource cannot set headers reliably)
 */
router.get('/admin/stream', asyncHandler(async (req, res) => {
  const token = req.query.token;

  if (!token) {
    console.log('❌ SSE /admin/stream: Missing token');
    return res.status(401).json({ success: false, message: 'Missing token' });
  }

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.log('❌ SSE /admin/stream: Invalid token');
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive || user.role !== 'admin') {
    console.log('❌ SSE /admin/stream: Not authorized - user:', { found: !!user, active: user?.isActive, role: user?.role });
    return res.status(401).json({ success: false, message: 'Not authorized' });
  }

  console.log('✅ SSE /admin/stream: Admin connected -', user.email);

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  // Send a comment to keep connection alive
  res.write(': connected\n\n');
  console.log('   Sent SSE connection handshake');

  const listener = (payload) => {
    try {
      res.write('event: like\n');
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      console.log('   SSE: Like event sent to admin', payload);
    } catch (err) {
      console.error('   SSE: Write error -', err.message);
    }
  };

  console.log('   Current active SSE listeners:', likeEmitter.listenerCount('like'));

  likeEmitter.on('like', listener);
  console.log('   Listening for like events');

  req.on('close', () => {
    likeEmitter.removeListener('like', listener);
    console.log('✅ SSE /admin/stream: Admin disconnected -', user.email);
  });
}));

/**
 * @route   GET /api/v1/feed/:id/like-status
 * @desc    Get like status and count for a feed item
 * @access  Public
 * 
 * Query params:
 *   - deviceId: string (required) - UUID v4 of the device
 * 
 * Response:
 *   - success: boolean
 *   - hasLiked: boolean - Whether this device has liked
 *   - likeCount: number - Current total like count
 */
router.get('/:id/like-status', asyncHandler(async (req, res) => {
  const { deviceId } = req.query;

  // Validate device ID
  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({
      success: false,
      message: 'Valid device ID is required',
      error: 'INVALID_DEVICE_ID'
    });
  }

  // Convert ID to ObjectId for consistent MongoDB queries
  const feedItemId = new mongoose.Types.ObjectId(req.params.id);

  // Get like status and count in parallel
  const [hasLiked, likeCount] = await Promise.all([
    FeedInteraction.hasDeviceLiked(feedItemId, deviceId),
    FeedInteraction.getLikeCount(feedItemId)
  ]);

  res.json({
    success: true,
    hasLiked,
    likeCount
  });
}));

/**
 * @route   GET /api/v1/feed/:id/like-count
 * @desc    Get like count for a feed item (no device ID needed)
 * @access  Public
 */
router.get('/:id/like-count', asyncHandler(async (req, res) => {
  // Convert ID to ObjectId for consistent MongoDB queries
  const feedItemId = new mongoose.Types.ObjectId(req.params.id);
  
  const likeCount = await FeedInteraction.getLikeCount(feedItemId);

  res.json({
    success: true,
    likeCount
  });
}));

/**
 * @route   POST /api/v1/feed/:id/share
 * @desc    Record a share action
 * @access  Public
 */
router.post('/:id/share', asyncHandler(async (req, res) => {
  const { deviceId } = req.body;

  // Validate device ID
  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({
      success: false,
      message: 'Valid device ID is required',
      error: 'INVALID_DEVICE_ID'
    });
  }

  // Convert ID to ObjectId for consistent MongoDB queries
  const feedItemId = new mongoose.Types.ObjectId(req.params.id);

  const feedItem = await Feed.findOne({ 
    _id: feedItemId, 
    status: 'published' 
  });

  if (!feedItem) {
    return res.status(404).json({
      success: false,
      message: 'Feed item not found'
    });
  }

  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const ipHash = hashIP(ip);
  
  const userData = {
    deviceId,
    ipHash,
    userAgent: req.headers['user-agent'] || '',
    deviceType: detectDeviceType(req.headers['user-agent']),
    country: req.headers['cf-ipcountry'] || ''
  };

  const result = await FeedInteraction.recordShare(feedItemId, userData);

  res.json({
    success: true,
    message: 'Share recorded',
    shareUrl: feedItem.originalUrl,
    shareCount: result.shareCount
  });
}));

// ============================================
// ADMIN ROUTES (Protected)
// ============================================

/**
 * @route   GET /api/v1/feed/admin/all
 * @desc    Get all feed items with analytics (admin)
 * @access  Private/Admin
 */
router.get('/admin/all', protect, asyncHandler(async (req, res) => {
  console.log('🔍 Admin fetching all feed items with real-time counts...');
  
  const { page = 1, limit = 20, status, platform, search } = req.query;

  const query = {};
  if (status) query.status = status;
  if (platform && platform !== 'all') query.platform = platform;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { originalUrl: { $regex: search, $options: 'i' } },
      { authorName: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [items, total] = await Promise.all([
    Feed.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'name email'),
    Feed.countDocuments(query)
  ]);

  // Fetch real-time like and share counts from FeedInteraction
  const itemsWithCounts = await Promise.all(items.map(async (item) => {
    const [likeCount, shareCount] = await Promise.all([
      FeedInteraction.getLikeCount(item._id),
      FeedInteraction.countDocuments({ feedItem: item._id, interactionType: 'share' })
    ]);
    
    console.log(`  Item: ${item.title || item._id} - Likes: ${likeCount}, Shares: ${shareCount}`);
    
    const itemObj = item.toObject();
    // Update analytics with real counts from FeedInteraction
    if (!itemObj.analytics) itemObj.analytics = {};
    itemObj.analytics.likes = likeCount;
    itemObj.analytics.shares = shareCount;
    
    return itemObj;
  }));

  res.json({
    success: true,
    count: itemsWithCounts.length,
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
    currentPage: parseInt(page),
    data: itemsWithCounts
  });
}));

/**
 * @route   POST /api/v1/feed/admin/preview
 * @desc    Preview a social media URL before adding
 * @access  Private/Admin
 */
router.post('/admin/preview', protect, [
  body('url').isURL().withMessage('Valid URL is required')
], validate, asyncHandler(async (req, res) => {
  const { url } = req.body;

  // Detect platform and content type
  const { platform, embedId } = detectPlatform(url);
  const contentType = detectContentType(url, platform);

  // Fetch oEmbed data
  const oembedData = await fetchOEmbed(url, platform);

  // Generate embed HTML
  let embedHtml = oembedData?.html || generateFallbackEmbed(url, platform, embedId);
  embedHtml = sanitizeEmbedHtml(embedHtml, platform);

  const preview = {
    originalUrl: url,
    platform,
    contentType,
    embedId,
    embedHtml,
    title: oembedData?.title || '',
    description: oembedData?.description || '',
    thumbnailUrl: oembedData?.thumbnail_url || '',
    authorName: oembedData?.author_name || '',
    authorUrl: oembedData?.author_url || '',
    width: oembedData?.width,
    height: oembedData?.height,
    isValid: !!embedHtml
  };

  res.json({
    success: true,
    data: preview
  });
}));

/**
 * @route   POST /api/v1/feed/admin
 * @desc    Create a new feed item
 * @access  Private/Admin
 */
router.post('/admin', protect, [
  body('url').isURL().withMessage('Valid URL is required'),
  body('status').optional().isIn(['draft', 'published', 'unpublished'])
], validate, asyncHandler(async (req, res) => {
  const { url, status = 'published', title, description, featured } = req.body;

  // Check for duplicate
  const existing = await Feed.findOne({ originalUrl: url });
  if (existing) {
    return res.status(400).json({
      success: false,
      message: 'This URL has already been added to the feed'
    });
  }

  // Detect platform and content type
  const { platform, embedId } = detectPlatform(url);
  const contentType = detectContentType(url, platform);

  // Fetch oEmbed data
  const oembedData = await fetchOEmbed(url, platform);

  // Generate embed HTML
  let embedHtml = oembedData?.html || generateFallbackEmbed(url, platform, embedId);
  embedHtml = sanitizeEmbedHtml(embedHtml, platform);

  // Get max order for published items
  const maxOrder = await Feed.findOne({ status: 'published' })
    .sort({ order: -1 })
    .select('order');
  const order = (maxOrder?.order || 0) + 1;

  const feedItem = await Feed.create({
    originalUrl: url,
    platform,
    contentType,
    embedId,
    embedHtml,
    oembedData: oembedData || {},
    title: title || oembedData?.title || '',
    description: description || '',
    thumbnailUrl: oembedData?.thumbnail_url || '',
    authorName: oembedData?.author_name || '',
    authorUrl: oembedData?.author_url || '',
    status,
    order,
    featured: featured || false,
    createdBy: req.user._id,
    isValid: !!embedHtml
  });

  res.status(201).json({
    success: true,
    message: 'Feed item created successfully',
    data: feedItem
  });
}));

/**
 * @route   PUT /api/v1/feed/admin/:id
 * @desc    Update a feed item
 * @access  Private/Admin
 */
router.put('/admin/:id', protect, asyncHandler(async (req, res) => {
  const { title, description, status, order, featured } = req.body;

  const feedItem = await Feed.findById(req.params.id);
  if (!feedItem) {
    return res.status(404).json({
      success: false,
      message: 'Feed item not found'
    });
  }

  // Update fields
  if (title !== undefined) feedItem.title = title;
  if (description !== undefined) feedItem.description = description;
  if (status !== undefined) feedItem.status = status;
  if (order !== undefined) feedItem.order = order;
  if (featured !== undefined) feedItem.featured = featured;

  await feedItem.save();

  res.json({
    success: true,
    message: 'Feed item updated successfully',
    data: feedItem
  });
}));

/**
 * @route   PUT /api/v1/feed/admin/:id/refresh
 * @desc    Refresh embed data for a feed item
 * @access  Private/Admin
 */
router.put('/admin/:id/refresh', protect, asyncHandler(async (req, res) => {
  const feedItem = await Feed.findById(req.params.id);
  if (!feedItem) {
    return res.status(404).json({
      success: false,
      message: 'Feed item not found'
    });
  }

  // Re-fetch oEmbed data
  const oembedData = await fetchOEmbed(feedItem.originalUrl, feedItem.platform);
  
  if (oembedData) {
    await feedItem.refreshEmbed(oembedData);
    res.json({
      success: true,
      message: 'Embed refreshed successfully',
      data: feedItem
    });
  } else {
    // Try fallback embed
    const embedHtml = generateFallbackEmbed(feedItem.originalUrl, feedItem.platform, feedItem.embedId);
    feedItem.embedHtml = sanitizeEmbedHtml(embedHtml, feedItem.platform);
    feedItem.lastValidatedAt = new Date();
    await feedItem.save();

    res.json({
      success: true,
      message: 'Used fallback embed',
      data: feedItem
    });
  }
}));

/**
 * @route   PUT /api/v1/feed/admin/reorder
 * @desc    Reorder feed items
 * @access  Private/Admin
 */
router.put('/admin/reorder', protect, [
  body('orders').isArray().withMessage('Orders array is required')
], validate, asyncHandler(async (req, res) => {
  const { orders } = req.body;

  // Update all orders in bulk
  const bulkOps = orders.map(item => ({
    updateOne: {
      filter: { _id: item.id },
      update: { order: item.order }
    }
  }));

  await Feed.bulkWrite(bulkOps);

  res.json({
    success: true,
    message: 'Feed items reordered successfully'
  });
}));

/**
 * @route   DELETE /api/v1/feed/admin/:id
 * @desc    Delete a feed item
 * @access  Private/Admin
 */
router.delete('/admin/:id', protect, asyncHandler(async (req, res) => {
  // Convert ID to ObjectId for consistent MongoDB queries
  const feedItemId = new mongoose.Types.ObjectId(req.params.id);
  
  const feedItem = await Feed.findById(feedItemId);
  if (!feedItem) {
    return res.status(404).json({
      success: false,
      message: 'Feed item not found'
    });
  }

  // Delete associated interactions
  await FeedInteraction.deleteMany({ feedItem: feedItemId });

  // Delete the feed item
  await feedItem.deleteOne();

  res.json({
    success: true,
    message: 'Feed item deleted successfully'
  });
}));

/**
 * @route   PUT /api/v1/feed/admin/:id/toggle
 * @desc    Toggle feed item publish status
 * @access  Private/Admin
 */
router.put('/admin/:id/toggle', protect, asyncHandler(async (req, res) => {
  const feedItem = await Feed.findById(req.params.id);
  if (!feedItem) {
    return res.status(404).json({
      success: false,
      message: 'Feed item not found'
    });
  }

  feedItem.status = feedItem.status === 'published' ? 'unpublished' : 'published';
  await feedItem.save();

  res.json({
    success: true,
    message: `Feed item ${feedItem.status}`,
    data: feedItem
  });
}));

// ============================================
// ANALYTICS ROUTES (Admin Only)
// ============================================

/**
 * @route   GET /api/v1/feed/admin/analytics/overview
 * @desc    Get feed analytics overview
 * @access  Private/Admin
 */
router.get('/admin/analytics/overview', protect, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Get total stats
  const [totalItems, publishedItems, totalLikes, totalShares] = await Promise.all([
    Feed.countDocuments(),
    Feed.countDocuments({ status: 'published' }),
    FeedInteraction.countDocuments({ interactionType: 'like' }),
    FeedInteraction.countDocuments({ interactionType: 'share' })
  ]);

  console.log('📊 Analytics Overview:', {
    totalItems,
    publishedItems,
    totalLikes,
    totalShares
  });

  // Get platform breakdown with real interaction counts
  const publishedFeeds = await Feed.find({ status: 'published' });
  const platformBreakdown = await Promise.all(
    ['instagram', 'youtube', 'facebook', 'twitter', 'tiktok', 'vimeo', 'linkedin'].map(async (platform) => {
      const feedIds = publishedFeeds.filter(f => f.platform === platform).map(f => f._id);
      if (feedIds.length === 0) return null;

      const [likes, shares] = await Promise.all([
        FeedInteraction.countDocuments({ feedItem: { $in: feedIds }, interactionType: 'like' }),
        FeedInteraction.countDocuments({ feedItem: { $in: feedIds }, interactionType: 'share' })
      ]);

      return {
        _id: platform,
        count: feedIds.length,
        likes,
        shares,
        views: 0 // Views are still tracked in Feed model if needed
      };
    })
  );

  // Filter out null platforms and sort by count
  const validPlatformBreakdown = platformBreakdown.filter(p => p !== null).sort((a, b) => b.count - a.count);

  // Get top performing items with real like counts
  const topItemsWithCounts = await Promise.all(
    publishedFeeds.map(async (item) => {
      const likeCount = await FeedInteraction.getLikeCount(item._id);
      return {
        ...item.toObject(),
        realLikeCount: likeCount
      };
    })
  );

  // Sort by real like count and take top 5
  const topItems = topItemsWithCounts
    .sort((a, b) => b.realLikeCount - a.realLikeCount)
    .slice(0, 5)
    .map(item => ({
      _id: item._id,
      title: item.title,
      originalUrl: item.originalUrl,
      platform: item.platform,
      thumbnailUrl: item.thumbnailUrl,
      analytics: {
        likes: item.realLikeCount,
        shares: item.analytics?.shares || 0,
        views: item.analytics?.views || 0
      }
    }));

  // Calculate total views from all feeds
  const viewsAggregate = await Feed.aggregate([
    {
      $group: {
        _id: null,
        totalViews: { $sum: '$analytics.views' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      overview: {
        totalItems,
        publishedItems,
        totalInteractions: totalLikes + totalShares,
        totalLikes,
        totalShares,
        totalViews: viewsAggregate[0]?.totalViews || 0
      },
      platformBreakdown: validPlatformBreakdown,
      topItems
    }
  });
}));

/**
 * @route   GET /api/v1/feed/admin/analytics/:id
 * @desc    Get analytics for a specific feed item
 * @access  Private/Admin
 */
router.get('/admin/analytics/:id', protect, asyncHandler(async (req, res) => {
  // Convert ID to ObjectId for consistent MongoDB queries
  const feedItemId = new mongoose.Types.ObjectId(req.params.id);
  
  const feedItem = await Feed.findById(feedItemId);
  if (!feedItem) {
    return res.status(404).json({
      success: false,
      message: 'Feed item not found'
    });
  }

  const analytics = await FeedInteraction.getAnalytics(feedItemId, {
    startDate: req.query.startDate,
    endDate: req.query.endDate
  });

  res.json({
    success: true,
    data: {
      feedItem: {
        id: feedItem._id,
        title: feedItem.title,
        originalUrl: feedItem.originalUrl,
        platform: feedItem.platform,
        analytics: feedItem.analytics
      },
      interactionDetails: analytics
    }
  });
}));

/**
 * @route   GET /api/v1/feed/admin/analytics/engagement
 * @desc    Get platform-wise engagement breakdown
 * @access  Private/Admin
 */
router.get('/admin/analytics/engagement', protect, asyncHandler(async (req, res) => {
  const engagement = await FeedInteraction.getPlatformEngagement({
    startDate: req.query.startDate,
    endDate: req.query.endDate
  });

  res.json({
    success: true,
    data: engagement
  });
}));

module.exports = router;
