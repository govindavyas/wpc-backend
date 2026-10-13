const mongoose = require('mongoose');

/**
 * Feed Item Schema
 * Stores social media embeds for the universal feed system
 * Supports: Instagram, YouTube, Facebook, X/Twitter, Vimeo, TikTok, LinkedIn
 */
const FeedSchema = new mongoose.Schema({
  // Original social media post URL
  originalUrl: {
    type: String,
    required: [true, 'Original URL is required'],
    trim: true
  },

  // Detected platform
  platform: {
    type: String,
    enum: ['instagram', 'youtube', 'facebook', 'twitter', 'vimeo', 'tiktok', 'linkedin', 'other'],
    required: true
  },

  // Content type (image or video)
  contentType: {
    type: String,
    enum: ['image', 'video', 'mixed'],
    default: 'mixed'
  },

  // Embed data
  embedHtml: {
    type: String,
    default: ''
  },

  embedId: {
    type: String,
    default: ''
  },

  // oEmbed response data (cached)
  oembedData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Display metadata
  title: {
    type: String,
    trim: true,
    default: ''
  },

  description: {
    type: String,
    trim: true,
    default: ''
  },

  thumbnailUrl: {
    type: String,
    default: ''
  },

  // Author/source info from oEmbed
  authorName: {
    type: String,
    default: ''
  },

  authorUrl: {
    type: String,
    default: ''
  },

  // Publication status
  status: {
    type: String,
    enum: ['draft', 'published', 'unpublished'],
    default: 'draft'
  },

  // Display order for manual sorting
  order: {
    type: Number,
    default: 0
  },

  // Engagement tracking (internal only)
  analytics: {
    likes: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    views: {
      type: Number,
      default: 0
    }
  },

  // Whether the embed is still valid/accessible
  isValid: {
    type: Boolean,
    default: true
  },

  // Last validation check
  lastValidatedAt: {
    type: Date,
    default: Date.now
  },

  // Error message if embed fails
  errorMessage: {
    type: String,
    default: ''
  },

  // Admin who created this item
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Featured flag for homepage display
  featured: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Indexes for efficient querying
FeedSchema.index({ status: 1, order: 1 });
FeedSchema.index({ platform: 1 });
FeedSchema.index({ createdAt: -1 });
FeedSchema.index({ 'analytics.likes': -1 });

// Virtual for checking if embed is stale (older than 24 hours)
FeedSchema.virtual('isStale').get(function() {
  const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours
  return Date.now() - this.lastValidatedAt > staleThreshold;
});

// Pre-save hook to normalize URL
FeedSchema.pre('save', function(next) {
  if (this.originalUrl) {
    // Remove trailing slashes and clean URL
    this.originalUrl = this.originalUrl.trim().replace(/\/+$/, '');
  }
  next();
});

// Static method to get published feed items
FeedSchema.statics.getPublished = function(options = {}) {
  const { page = 1, limit = 20, platform } = options;
  const query = { status: 'published', isValid: true };
  
  if (platform) {
    query.platform = platform;
  }

  return this.find(query)
    .sort({ order: 1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('-oembedData -createdBy -analytics');
};

// Static method to increment engagement
FeedSchema.statics.incrementEngagement = async function(id, type) {
  const validTypes = ['likes', 'shares', 'views'];
  if (!validTypes.includes(type)) {
    throw new Error('Invalid engagement type');
  }

  return this.findByIdAndUpdate(
    id,
    { $inc: { [`analytics.${type}`]: 1 } },
    { new: true }
  );
};

// Method to refresh embed data
FeedSchema.methods.refreshEmbed = async function(embedData) {
  this.embedHtml = embedData.html || this.embedHtml;
  this.thumbnailUrl = embedData.thumbnail_url || this.thumbnailUrl;
  this.title = embedData.title || this.title;
  this.authorName = embedData.author_name || this.authorName;
  this.authorUrl = embedData.author_url || this.authorUrl;
  this.oembedData = embedData;
  this.lastValidatedAt = new Date();
  this.isValid = true;
  this.errorMessage = '';
  return this.save();
};

// Method to mark as invalid
FeedSchema.methods.markInvalid = async function(errorMessage) {
  this.isValid = false;
  this.errorMessage = errorMessage;
  this.lastValidatedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Feed', FeedSchema);
