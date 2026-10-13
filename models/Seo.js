const mongoose = require('mongoose');

/**
 * SEO Model - Stores page-specific SEO metadata for dynamic management
 * All SEO content is editable from Admin Panel only
 */
const SeoSchema = new mongoose.Schema({
  // Page identification
  pageSlug: {
    type: String,
    required: [true, 'Page slug is required'],
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  pageName: {
    type: String,
    required: [true, 'Page name is required'],
    trim: true
  },
  pageType: {
    type: String,
    enum: ['static', 'dynamic', 'content'],
    default: 'static'
  },

  // Basic Meta Tags
  metaTitle: {
    type: String,
    required: [true, 'Meta title is required'],
    trim: true,
    maxlength: [70, 'Meta title should not exceed 70 characters']
  },
  metaDescription: {
    type: String,
    required: [true, 'Meta description is required'],
    trim: true,
    maxlength: [160, 'Meta description should not exceed 160 characters']
  },
  metaKeywords: [{
    type: String,
    trim: true
  }],

  // Open Graph Tags
  ogTitle: {
    type: String,
    trim: true,
    maxlength: [95, 'OG title should not exceed 95 characters']
  },
  ogDescription: {
    type: String,
    trim: true,
    maxlength: [200, 'OG description should not exceed 200 characters']
  },
  ogImage: {
    type: String,
    trim: true
  },
  ogType: {
    type: String,
    enum: ['website', 'article', 'video.movie', 'video.tv_show', 'profile', 'product'],
    default: 'website'
  },
  ogLocale: {
    type: String,
    default: 'en_US'
  },
  ogSiteName: {
    type: String,
    default: 'WHITE PANDA CREATIONS'
  },

  // Twitter Card Tags
  twitterCard: {
    type: String,
    enum: ['summary', 'summary_large_image', 'player'],
    default: 'summary_large_image'
  },
  twitterTitle: {
    type: String,
    trim: true,
    maxlength: [70, 'Twitter title should not exceed 70 characters']
  },
  twitterDescription: {
    type: String,
    trim: true,
    maxlength: [200, 'Twitter description should not exceed 200 characters']
  },
  twitterImage: {
    type: String,
    trim: true
  },
  twitterSite: {
    type: String,
    trim: true,
    default: '@whitepandacreations'
  },
  twitterCreator: {
    type: String,
    trim: true
  },

  // Canonical & URL
  canonicalUrl: {
    type: String,
    trim: true
  },
  alternateUrls: [{
    hreflang: String,
    href: String
  }],

  // Robots Meta
  robotsMeta: {
    type: String,
    default: 'index, follow',
    enum: [
      'index, follow',
      'index, nofollow',
      'noindex, follow',
      'noindex, nofollow',
      'index, follow, noarchive',
      'noindex, nofollow, noarchive'
    ]
  },
  googlebot: {
    type: String,
    default: 'index, follow'
  },

  // Structured Data / Schema JSON-LD
  schemaType: {
    type: String,
    enum: ['Organization', 'WebSite', 'WebPage', 'Movie', 'Article', 'Person', 'LocalBusiness', 'BreadcrumbList', 'FAQPage', 'VideoObject'],
    default: 'WebPage'
  },
  schemaJson: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // Additional Meta
  author: {
    type: String,
    trim: true,
    default: 'WHITE PANDA CREATIONS'
  },
  publisher: {
    type: String,
    trim: true,
    default: 'WHITE PANDA CREATIONS'
  },
  copyright: {
    type: String,
    trim: true
  },
  
  // Priority for sitemap
  sitemapPriority: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },
  sitemapChangeFreq: {
    type: String,
    enum: ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'],
    default: 'weekly'
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
SeoSchema.index({ pageSlug: 1, isActive: 1 });
SeoSchema.index({ pageType: 1 });

// Virtual for full OG data
SeoSchema.virtual('openGraph').get(function() {
  return {
    title: this.ogTitle || this.metaTitle,
    description: this.ogDescription || this.metaDescription,
    image: this.ogImage,
    type: this.ogType,
    locale: this.ogLocale,
    siteName: this.ogSiteName
  };
});

// Virtual for full Twitter data
SeoSchema.virtual('twitterMeta').get(function() {
  return {
    card: this.twitterCard,
    title: this.twitterTitle || this.ogTitle || this.metaTitle,
    description: this.twitterDescription || this.ogDescription || this.metaDescription,
    image: this.twitterImage || this.ogImage,
    site: this.twitterSite,
    creator: this.twitterCreator
  };
});

// Static method to get SEO by slug with fallback
SeoSchema.statics.getBySlug = async function(slug) {
  let seo = await this.findOne({ pageSlug: slug, isActive: true });
  
  // Fallback to home page SEO if not found
  if (!seo) {
    seo = await this.findOne({ pageSlug: 'home', isActive: true });
  }
  
  return seo;
};

// Static method to get all active SEO records
SeoSchema.statics.getAllActive = async function() {
  return this.find({ isActive: true }).sort({ pageName: 1 });
};

// Method to validate schema JSON
SeoSchema.methods.validateSchemaJson = function() {
  if (!this.schemaJson) return true;
  
  try {
    // Check if it has @context and @type
    if (typeof this.schemaJson === 'object') {
      return this.schemaJson['@context'] && this.schemaJson['@type'];
    }
    
    // If string, try to parse
    const parsed = JSON.parse(this.schemaJson);
    return parsed['@context'] && parsed['@type'];
  } catch (error) {
    return false;
  }
};

// Pre-save hook to ensure canonical URL
SeoSchema.pre('save', function(next) {
  // Set default canonical URL if not provided
  if (!this.canonicalUrl) {
    this.canonicalUrl = `https://whitepandacreations.com/${this.pageSlug === 'home' ? '' : this.pageSlug}`;
  }
  
  // Set copyright if not provided
  if (!this.copyright) {
    this.copyright = `© ${new Date().getFullYear()} WHITE PANDA CREATIONS. All rights reserved.`;
  }
  
  // Sync Twitter fields with OG if not set
  if (!this.twitterTitle && this.ogTitle) {
    this.twitterTitle = this.ogTitle;
  }
  if (!this.twitterDescription && this.ogDescription) {
    this.twitterDescription = this.ogDescription;
  }
  if (!this.twitterImage && this.ogImage) {
    this.twitterImage = this.ogImage;
  }
  
  next();
});

// JSON transform to include virtuals
SeoSchema.set('toJSON', { virtuals: true });
SeoSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Seo', SeoSchema);
