const mongoose = require('mongoose');
const slugify = require('slugify');

const NewsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'News title is required'],
    trim: true
  },
  slug: {
    type: String,
    unique: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    enum: ['Production', 'Casting', 'Music', 'Announcement', 'Release', 'Awards', 'Events', 'Behind The Scenes', 'General']
  },
  summary: {
    type: String,
    required: [true, 'Summary is required'],
    trim: true,
    maxlength: [500, 'Summary cannot be more than 500 characters']
  },
  fullText: {
    type: String,
    required: [true, 'Full text content is required']
  },
  imageUrl: {
    type: String,
    default: '/assets/news/default-news.jpg'
  },
  thumbnailUrl: String,
  author: {
    type: String,
    trim: true,
    default: 'WHITE PANDA CREATIONS Team'
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Related content
  relatedMovie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie'
  },
  
  // External link (if news links to external source)
  externalLink: String,
  
  // Display settings
  showOnDashboard: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  
  // SEO
  seoMeta: {
    title: String,
    description: String,
    keywords: [String]
  },
  
  // Stats
  views: {
    type: Number,
    default: 0
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Generate slug before saving
NewsSchema.pre('save', function(next) {
  if (this.isModified('title') || !this.slug) {
    const datePrefix = new Date(this.date).toISOString().slice(0, 10);
    this.slug = `${datePrefix}-${slugify(this.title, { lower: true, strict: true })}`;
  }
  next();
});

// Indexes (slug already has unique index)
NewsSchema.index({ date: -1 });
NewsSchema.index({ category: 1 });
NewsSchema.index({ tags: 1 });
NewsSchema.index({ isActive: 1, showOnDashboard: 1 });
NewsSchema.index({ featured: 1 });

// Static method to get dashboard news
NewsSchema.statics.getDashboardNews = function(limit = 4) {
  return this.find({ isActive: true, showOnDashboard: true })
    .sort({ date: -1 })
    .limit(limit);
};

// Static method to get news by category
NewsSchema.statics.getByCategory = function(category) {
  return this.find({ isActive: true, category })
    .sort({ date: -1 });
};

module.exports = mongoose.model('News', NewsSchema);
