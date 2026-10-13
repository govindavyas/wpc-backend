const mongoose = require('mongoose');

/**
 * Feed Interaction Schema
 * Tracks user interactions (likes/shares) without requiring authentication
 * Uses persistent device ID for reliable tracking across sessions
 * 
 * ARCHITECTURE:
 * - deviceId: UUID generated on client, stored in localStorage permanently
 * - Each device can only like an item once (enforced at DB level)
 * - Like counts are derived from actual database records, not counters
 * - No toggle functionality - likes are permanent
 */
const FeedInteractionSchema = new mongoose.Schema({
  // Reference to the feed item
  feedItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feed',
    required: true,
    index: true
  },

  // Type of interaction
  interactionType: {
    type: String,
    enum: ['like', 'share'],
    required: true
  },

  // PRIMARY IDENTIFIER: Device ID (UUID from client localStorage)
  // This is the authoritative identifier for duplicate prevention
  deviceId: {
    type: String,
    required: [true, 'Device ID is required'],
    validate: {
      validator: function(v) {
        // Validate UUID v4 format
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
      },
      message: 'Invalid device ID format'
    }
  },

  // IP address (hashed for privacy) - secondary identifier for analytics
  ipHash: {
    type: String,
    default: ''
  },

  // User agent string - for analytics
  userAgent: {
    type: String,
    default: ''
  },

  // Device type detected - for analytics
  deviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop', 'unknown'],
    default: 'unknown'
  },

  // Country/region (if geo-IP available) - for analytics
  country: {
    type: String,
    default: ''
  }

}, {
  timestamps: true
});

// ==============================================
// DATABASE CONSTRAINTS (Critical for data integrity)
// ==============================================

// PRIMARY CONSTRAINT: One like per device per item
// This is the core constraint that prevents duplicate likes
FeedInteractionSchema.index(
  { feedItem: 1, interactionType: 1, deviceId: 1 }, 
  { unique: true, name: 'unique_device_interaction' }
);

// Performance indexes
FeedInteractionSchema.index({ feedItem: 1, interactionType: 1 });
FeedInteractionSchema.index({ deviceId: 1 });
FeedInteractionSchema.index({ createdAt: -1 });

// ==============================================
// STATIC METHODS
// ==============================================

/**
 * Check if a device has already liked an item
 * @param {ObjectId|string} feedItemId - The feed item ID
 * @param {string} deviceId - The device UUID
 * @returns {boolean} True if device has already liked
 */
FeedInteractionSchema.statics.hasDeviceLiked = async function(feedItemId, deviceId) {
  if (!deviceId) return false;
  
  // Convert feedItemId to ObjectId if it's a string (for consistent query matching)
  const objectId = typeof feedItemId === 'string' 
    ? require('mongoose').Types.ObjectId(feedItemId) 
    : feedItemId;
  
  const existing = await this.findOne({
    feedItem: objectId,
    interactionType: 'like',
    deviceId: deviceId
  }).lean();
  
  return !!existing;
};

/**
 * Get the actual like count for an item (derived from database)
 * @param {ObjectId|string} feedItemId - The feed item ID
 * @returns {number} The like count
 */
FeedInteractionSchema.statics.getLikeCount = async function(feedItemId) {
  // Convert feedItemId to ObjectId if it's a string (for consistent query matching)
  const objectId = typeof feedItemId === 'string' 
    ? require('mongoose').Types.ObjectId(feedItemId) 
    : feedItemId;
  
  const count = await this.countDocuments({
    feedItem: objectId,
    interactionType: 'like'
  });
  return count;
};

/**
 * Record a like from a device
 * - Rejects duplicate likes (device can only like once)
 * - Returns the new like count
 * 
 * @param {ObjectId|string} feedItemId - The feed item ID
 * @param {Object} userData - User/device data
 * @returns {Object} { success, alreadyLiked, likeCount }
 */
FeedInteractionSchema.statics.recordLike = async function(feedItemId, userData) {
  const { deviceId, ipHash, userAgent, deviceType, country } = userData;

  if (!deviceId) {
    throw new Error('Device ID is required');
  }

  // Convert feedItemId to ObjectId if it's a string (for consistent query matching)
  const objectId = typeof feedItemId === 'string' 
    ? require('mongoose').Types.ObjectId(feedItemId) 
    : feedItemId;

  // Check if already liked
  const alreadyLiked = await this.hasDeviceLiked(objectId, deviceId);
  
  if (alreadyLiked) {
    // Return current count - no error, just indicate already liked
    const likeCount = await this.getLikeCount(objectId);
    return { 
      success: true, 
      alreadyLiked: true, 
      likeCount,
      message: 'Already liked'
    };
  }

  try {
    // Create new like
    await this.create({
      feedItem: objectId,
      interactionType: 'like',
      deviceId,
      ipHash: ipHash || '',
      userAgent: userAgent || '',
      deviceType: deviceType || 'unknown',
      country: country || ''
    });

    // Get updated count
    const likeCount = await this.getLikeCount(objectId);
    
    return { 
      success: true, 
      alreadyLiked: false, 
      likeCount,
      message: 'Liked successfully'
    };
  } catch (error) {
    // Handle duplicate key error (race condition protection)
    if (error.code === 11000) {
      const likeCount = await this.getLikeCount(objectId);
      return { 
        success: true, 
        alreadyLiked: true, 
        likeCount,
        message: 'Already liked'
      };
    }
    throw error;
  }
};

/**
 * Record a share from a device
 * Shares can be recorded multiple times per device
 * 
 * @param {ObjectId|string} feedItemId - The feed item ID
 * @param {Object} userData - User/device data
 * @returns {Object} { success, shareCount }
 */
FeedInteractionSchema.statics.recordShare = async function(feedItemId, userData) {
  const { deviceId, ipHash, userAgent, deviceType, country } = userData;

  if (!deviceId) {
    throw new Error('Device ID is required');
  }

  // Convert feedItemId to ObjectId if it's a string (for consistent query matching)
  const objectId = typeof feedItemId === 'string' 
    ? require('mongoose').Types.ObjectId(feedItemId) 
    : feedItemId;

  // Record the share
  await this.create({
    feedItem: objectId,
    interactionType: 'share',
    deviceId,
    ipHash: ipHash || '',
    userAgent: userAgent || '',
    deviceType: deviceType || 'unknown',
    country: country || ''
  });

  // Get share count
  const shareCount = await this.countDocuments({
    feedItem: objectId,
    interactionType: 'share'
  });

  return { success: true, shareCount };
};

// Static method to get analytics for admin
FeedInteractionSchema.statics.getAnalytics = async function(feedItemId, options = {}) {
  const { startDate, endDate } = options;
  
  const matchStage = { feedItem: new mongoose.Types.ObjectId(feedItemId) };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const analytics = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          type: '$interactionType',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  // Also get device breakdown
  const deviceBreakdown = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$deviceType',
        count: { $sum: 1 }
      }
    }
  ]);

  return { timeline: analytics, devices: deviceBreakdown };
};

// Static method to get platform-wise engagement breakdown
FeedInteractionSchema.statics.getPlatformEngagement = async function(options = {}) {
  const { startDate, endDate } = options;
  
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: 'feeds',
        localField: 'feedItem',
        foreignField: '_id',
        as: 'feed'
      }
    },
    { $unwind: '$feed' },
    {
      $group: {
        _id: {
          platform: '$feed.platform',
          type: '$interactionType'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('FeedInteraction', FeedInteractionSchema);
